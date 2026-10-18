import {DEFAULT_SETTINGS, chunkText, buildInstructions, makePrompt,
  extractResponseText, cleanForTts, safeFilename, exportParts} from './core.js';

const $ = id => document.getElementById(id);
let settings = {...DEFAULT_SETTINGS};
let running = false;
let job = null;
let controller = null;
let saveTimer = null;
let lastConsumedStamp = 0;

const MODE_IDS = ['mode','profile','sourceLanguage','useGlossary','notes','inputText','outputText','filename'];
function setStatus(text, kind = '') { $('status').textContent = text; $('status').className = 'status ' + kind; }
function displayCounts() {
  $('inputCount').textContent = $('inputText').value.length.toLocaleString('vi-VN') + ' ký tự';
  $('outputCount').textContent = $('outputText').value.length.toLocaleString('vi-VN') + ' ký tự';
}
function updateModeUI() {
  $('sourceLanguage').disabled = $('mode').value !== 'translate';
  $('runBtn').textContent = job && !running && job.index > 0 ? '↻ Tiếp tục từ phần ' + (job.index + 1) : '✦ Bắt đầu xử lý';
}
function serializeDraft() {
  return {
    input: $('inputText').value, output: $('outputText').value,
    mode: $('mode').value, profile: $('profile').value,
    sourceLanguage: $('sourceLanguage').value,
    useGlossary: $('useGlossary').checked,
    notes: $('notes').value,
    filename: $('filename').value
  };
}
function queueDraftSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.session.set({tvtDraft: serializeDraft()}).catch(console.error);
  }, 250);
}
function readCurrentConfig() {
  return {
    mode: $('mode').value, profile: $('profile').value,
    sourceLanguage: $('sourceLanguage').value,
    useGlossary: $('useGlossary').checked,
    customStyle: $('profile').value === 'custom'
      ? [settings.customStyle || '', $('notes').value || ''].filter(Boolean).join('\n')
      : $('notes').value || '',
    glossary: settings.glossary || '',
    presetOverrides: settings.presetOverrides || {}
  };
}
function currentSignature() {
  return JSON.stringify({source: $('inputText').value, cfg: readCurrentConfig(),
    model: settings.model, chunkSize: settings.chunkSize, maxOutputTokens: settings.maxOutputTokens});
}
function onFormChanged() {
  displayCounts();
  updateModeUI();
  queueDraftSave();
  if (job && job.signature !== currentSignature() && !running) {
    job = null; updateModeUI();
  }
}
function receiveIncoming(data) {
  const item = data?.incomingSelection;
  if (!item?.text || item.capturedAt <= lastConsumedStamp) return;
  lastConsumedStamp = item.capturedAt;
  if (running) {
    setStatus('Đang xử lý. Văn bản vừa chọn chưa được nạp; hãy dừng để nạp lại.', 'error');
    return;
  }
  $('inputText').value = item.text;
  job = null;
  displayCounts(); updateModeUI(); queueDraftSave();
  setStatus('Đã lấy ' + item.text.length.toLocaleString('vi-VN') + ' ký tự từ trang web.', 'good');
  chrome.storage.session.remove('incomingSelection').catch(console.error);
}

async function init() {
  const [local, session] = await Promise.all([
    chrome.storage.local.get(null), chrome.storage.session.get(['incomingSelection','tvtDraft'])
  ]);
  settings = {...DEFAULT_SETTINGS, ...local};
  const draft = session.tvtDraft || {};
  $('mode').value = draft.mode || settings.mode;
  $('profile').value = draft.profile || settings.profile;
  $('sourceLanguage').value = draft.sourceLanguage || settings.sourceLanguage;
  $('useGlossary').checked = draft.useGlossary ?? settings.useGlossary;
  $('notes').value = draft.notes || '';
  $('inputText').value = draft.input || '';
  $('outputText').value = draft.output || '';
  $('filename').value = draft.filename || 'truyen_tts';
  displayCounts(); updateModeUI();
  receiveIncoming(session);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes.incomingSelection?.newValue) receiveIncoming({incomingSelection: changes.incomingSelection.newValue});
    if (area === 'local') {
      for (const [key, value] of Object.entries(changes)) settings[key] = value.newValue;
    }
  });
  for (const id of MODE_IDS) {
    $(id).addEventListener(id === 'useGlossary' || ['mode','profile','sourceLanguage'].includes(id) ? 'change' : 'input', onFormChanged);
  }
  setStatus('Sẵn sàng. Bôi đen đoạn truyện trên website hoặc dán trực tiếp.');
}

async function grabText(type) {
  if (running) return;
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tab?.id) throw new Error('Không tìm được tab đang mở.');
    const results = await chrome.scripting.executeScript({
      target: {tabId: tab.id},
      args: [type],
      func: (which) => {
        if (which === 'selection') {
          const a = document.activeElement;
          if (a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT') && a.type !== 'password' && typeof a.selectionStart === 'number') {
            return (a.value || '').slice(a.selectionStart, a.selectionEnd);
          }
          return window.getSelection()?.toString() || '';
        }
        const candidates = [...document.querySelectorAll('article, main, [role="main"], .chapter-content, #chapter-content, .reading-content, .entry-content, .post-content')];
        const scored = candidates.map(e => ({text: e.innerText?.trim() || '', length: e.innerText?.trim().length || 0}))
          .filter(x => x.length > 80).sort((a,b) => b.length - a.length);
        return (scored[0]?.text || document.body?.innerText || '').slice(0, 250000);
      }
    });
    const text = (results?.[0]?.result || '').trim();
    if (!text) throw new Error(type === 'selection' ? 'Chưa có văn bản được bôi đen.' : 'Trang không có nội dung đọc được.');
    $('inputText').value = text;
    job = null;
    displayCounts(); updateModeUI(); queueDraftSave();
    setStatus(`Đã lấy ${text.length.toLocaleString('vi-VN')} ký tự. Kiểm tra nội dung trước khi gửi API.`, 'good');
  } catch (e) { setStatus('Không thể lấy nội dung: ' + e.message + ' Hãy copy và dán thủ công.', 'error'); }
}

async function getApiKey() {
  const [local, session] = await Promise.all([
    chrome.storage.local.get('apiKey'), chrome.storage.session.get('apiKey')
  ]);
  return session.apiKey || local.apiKey || '';
}

async function callOpenAI({apiKey, instructions, prompt, model, maxTokens, signal}) {
  const request = {
    model,
    instructions,
    input: prompt,
    max_output_tokens: maxTokens,
    store: false
  };
  if (model === 'gpt-6-luna') request.reasoning = {effort: 'none'};
  let response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`},
      body: JSON.stringify(request), signal
    });
  } catch (e) {
    if (signal.aborted) throw new Error('Đã dừng theo yêu cầu.');
    throw new Error('Lỗi mạng hoặc không kết nối được API: ' + e.message);
  }
  let result;
  try { result = await response.json(); } catch { throw new Error('API trả về dữ liệu không phải JSON.'); }
  if (!response.ok) {
    const msg = result.error?.message || `HTTP ${response.status}`;
    throw new Error(`API (${response.status}): ${msg}`);
  }
  if (result.status === 'incomplete' || result.incomplete_details) {
    throw new Error('Đầu ra bị cắt do giới hạn token. Giảm kích thước đoạn trong Cài đặt (2.000 ký tự) rồi chạy lại từ đầu.');
  }
  const text = extractResponseText(result);
  if (!text) throw new Error('Model không trả văn bản. Hãy thử tăng token đầu ra hoặc đổi model.');
  return cleanForTts(text);
}

function setRunning(value) {
  running = value;
  $('runBtn').disabled = value;
  $('stopBtn').classList.toggle('hidden', !value);
  $('settingsBtn').disabled = value;
  for (const id of ['mode','profile','sourceLanguage','useGlossary','inputText','notes']) $(id).disabled = value;
  $('outputText').disabled = value;
  updateModeUI();
}

async function run() {
  if (running) return;
  const source = $('inputText').value;
  if (!source.trim()) return setStatus('Hãy nhập hoặc lấy văn bản nguồn trước.', 'error');
  const apiKey = await getApiKey();
  if (!apiKey) return setStatus('Chưa có API key. Nhấn ⚙ để cài đặt OpenAI API.', 'error');
  const sig = currentSignature();
  if (!job || job.signature !== sig) {
    job = {signature:sig, chunks:chunkText(source, settings.chunkSize), index:0, results:[]};
    $('outputText').value = '';
  }
  const config = readCurrentConfig();
  const instructions = buildInstructions(config);
  controller = new AbortController();
  setRunning(true);
  $('progress').classList.remove('hidden');
  const {signal} = controller;
  try {
    while (job.index < job.chunks.length) {
      if (signal.aborted) throw new Error('Đã dừng theo yêu cầu.');
      const i = job.index;
      $('progressFill').style.width = ((i / job.chunks.length) * 100) + '%';
      setStatus(`Đang xử lý phần ${i+1}/${job.chunks.length} • ${job.chunks[i].length.toLocaleString('vi-VN')} ký tự nguồn...`);
      const priorContext = i ? job.chunks[i - 1].slice(-320) : '';
      const output = await callOpenAI({
        apiKey, instructions,
        prompt: makePrompt(job.chunks[i], i, job.chunks.length, priorContext),
        model: settings.model,
        maxTokens: settings.maxOutputTokens,
        signal
      });
      // In same-language editing, an unusually short result probably dropped story content.
      if (['proofread','rewrite'].includes(config.mode) && job.chunks[i].length >= 700 &&
          output.length < job.chunks[i].length * 0.58) {
        throw new Error('Kết quả ngắn bất thường, có nguy cơ mất nội dung. Hãy giảm ký tự mỗi lượt API rồi chạy lại từ đầu.');
      }
      job.results.push(output);
      job.index++;
      $('outputText').value = job.results.join('\n\n');
      displayCounts();
      // Save completed portions only. A failing request won't erase prior sections.
      await chrome.storage.session.set({tvtDraft:serializeDraft()});
    }
    $('progressFill').style.width = '100%';
    const completeChunks = job.chunks.length;
    job = null;
    setStatus(`Hoàn tất ${completeChunks} phần. Đã giữ kết quả để chỉnh sửa và xuất TXT.`, 'good');
  } catch (e) {
    setStatus(e.message + (job?.index ? ` Đã lưu ${job.index}/${job.chunks.length} phần; nhấn “Tiếp tục” để chạy phần còn lại.` : ''), 'error');
  } finally {
    setRunning(false);
    controller = null;
    updateModeUI();
    queueDraftSave();
  }
}

function downloadOne(text, filename) {
  // UTF-8 BOM is useful for Windows Notepad and older TTS import paths.
  const url = URL.createObjectURL(new Blob(['\uFEFF', text], {type:'text/plain;charset=utf-8'}));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 25000);
}
async function exportFile(split) {
  const text = $('outputText').value;
  if (!text.trim()) return setStatus('Chưa có nội dung để xuất TXT.', 'error');
  const name = safeFilename($('filename').value);
  if (!split) {
    downloadOne(text, `${name}.txt`);
    return setStatus(`Đã yêu cầu tải ${name}.txt (${text.length.toLocaleString('vi-VN')} ký tự).`, 'good');
  }
  const parts = exportParts(text, 50000);
  // Multiple downloads may require permission from Chrome.
  for (let i = 0; i < parts.length; i++) {
    downloadOne(parts[i], parts.length === 1 ? `${name}.txt` : `${name}_P${String(i+1).padStart(2,'0')}.txt`);
    if (parts.length > 1) await new Promise(resolve => setTimeout(resolve, 240));
  }
  setStatus(`Đã yêu cầu tải ${parts.length} phần TXT (mỗi phần ≤50.000 ký tự). Chrome có thể hỏi quyền tải nhiều tệp.`, 'good');
}

$('settingsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('grabSelectionBtn').addEventListener('click', () => grabText('selection'));
$('grabArticleBtn').addEventListener('click', () => grabText('article'));
$('clearBtn').addEventListener('click', () => {
  if (running) return;
  $('inputText').value = '';
  job = null;
  onFormChanged();
  setStatus('Đã xóa văn bản nguồn. Kết quả trước đó vẫn được giữ.');
});
$('runBtn').addEventListener('click', run);
$('stopBtn').addEventListener('click', () => controller?.abort());
$('copyBtn').addEventListener('click', async () => {
  const text = $('outputText').value;
  if (!text.trim()) return setStatus('Chưa có nội dung để sao chép.', 'error');
  try {await navigator.clipboard.writeText(text); setStatus('Đã sao chép kết quả vào clipboard.', 'good');}
  catch (e) {setStatus('Không thể sao chép: ' + e.message, 'error');}
});
$('downloadBtn').addEventListener('click', () => exportFile(false));
$('splitBtn').addEventListener('click', () => exportFile(true));

init().catch(e => setStatus('Không thể khởi tạo: ' + e.message, 'error'));
