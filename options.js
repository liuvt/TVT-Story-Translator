import {DEFAULT_SETTINGS, PRESETS} from './core.js';
const $ = id => document.getElementById(id);
const FIELDS = ['model', 'chunkSize', 'maxOutputTokens', 'glossary', 'rememberKey'];
let edits = {};
let editing = 'faithful';

function defaultGuides() {
  return Object.fromEntries(Object.keys(PRESETS).map(id => [id, id === 'custom' ? '' : PRESETS[id].guide]));
}
function saveVisibleGuide() { edits[editing] = $('profileGuide').value; }
function chooseGuide(id) {
  saveVisibleGuide(); editing = id;
  $('editProfile').value = id;
  $('profileGuide').value = edits[id] || '';
}

async function readSettings() {
  const [local, session] = await Promise.all([
    chrome.storage.local.get(null), chrome.storage.session.get('apiKey')
  ]);
  const opts = {...DEFAULT_SETTINGS, ...local};
  edits = {...defaultGuides(), ...(opts.presetOverrides || {}), custom: opts.customStyle || ''};
  for (const field of FIELDS) {
    if (field === 'rememberKey') $(field).checked = !!opts[field];
    else $(field).value = opts[field] ?? '';
  }
  editing = 'faithful'; $('editProfile').value = editing;
  $('profileGuide').value = edits[editing];
  $('apiKey').value = session.apiKey || local.apiKey || '';
}

async function saveSettings() {
  saveVisibleGuide();
  const data = {};
  for (const field of FIELDS) {
    data[field] = field === 'rememberKey' ? $('rememberKey').checked :
      ['chunkSize', 'maxOutputTokens'].includes(field) ? Number($(field).value) : $(field).value;
  }
  data.customStyle = edits.custom;
  data.presetOverrides = Object.fromEntries(['faithful','docsi','canon']
    .filter(id => edits[id] !== PRESETS[id].guide).map(id => [id, edits[id]]));
  data.model = data.model.trim();
  if (!data.model || !/^[a-zA-Z0-9._-]+$/.test(data.model)) throw new Error('Model không hợp lệ.');
  if (data.chunkSize < 500 || data.chunkSize > 12000) throw new Error('Số ký tự mỗi lượt không hợp lệ.');
  if (data.maxOutputTokens < 2500 || data.maxOutputTokens > 30000) throw new Error('Giới hạn token phải từ 2.500 đến 30.000.');
  const apiKey = $('apiKey').value.trim();
  if (apiKey && !apiKey.startsWith('sk-')) throw new Error('API key OpenAI thường bắt đầu bằng sk-. Vui lòng kiểm tra.');
  if (data.rememberKey) {
    data.apiKey = apiKey;
    await chrome.storage.local.set(data);
    await chrome.storage.session.remove('apiKey');
  } else {
    await chrome.storage.local.set(data);
    await chrome.storage.local.remove('apiKey');
    if (apiKey) await chrome.storage.session.set({apiKey});
    else await chrome.storage.session.remove('apiKey');
  }
}

$('editProfile').addEventListener('change', () => chooseGuide($('editProfile').value));
$('resetProfileBtn').addEventListener('click', () => {
  edits[editing] = editing === 'custom' ? '' : PRESETS[editing].guide;
  $('profileGuide').value = edits[editing];
  $('optionsStatus').textContent = 'Đã khôi phục nội dung preset. Nhấn “Lưu cài đặt” để áp dụng.';
});
$('saveBtn').addEventListener('click', async () => {
  const status = $('optionsStatus');
  try { await saveSettings(); status.textContent = '✓ Đã lưu'; status.className = 'status good'; }
  catch (e) { status.textContent = '✗ ' + e.message; status.className = 'status error'; }
});
$('resetBtn').addEventListener('click', async () => {
  if (!confirm('Khôi phục phong cách, từ điển và cấu hình mặc định? API key không bị xóa.')) return;
  for (const field of FIELDS) {
    if (field === 'rememberKey') continue;
    $(field).value = DEFAULT_SETTINGS[field] ?? '';
  }
  edits = defaultGuides(); editing = 'faithful';
  $('editProfile').value = editing; $('profileGuide').value = edits[editing];
  $('optionsStatus').textContent = 'Đã đặt giá trị mặc định. Nhấn “Lưu cài đặt” để áp dụng.';
});

readSettings().catch(e => { $('optionsStatus').textContent = e.message; });
