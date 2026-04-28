const ASANA_TOKEN     = 'YOUR_ASANA_PERSONAL_ACCESS_TOKEN';
const TESTFARM_GID    = '1213881735025332';
const ASSIGNEE_GID    = '1144816139914898';
const DUE_DAYS_OFFSET = 7;
const VMD_FIXED_ITEM_COUNT = 4;

const CF_STATUS           = '1207665965030077';
const CF_STATUS_PROGRESS  = '1207665965030078';
const CF_TASK_TYPE        = '1213891002087335';
const CF_TASK_TYPE_MD     = '1213891002087339';
const CF_TASK_TYPE_PC     = '1213891002087338';
const CF_TASK_TYPE_UPDATE = '1213891002087337';
const CF_EVENT_TYPE       = '';
const CF_STATUS_NAME      = '상태';
const CF_STATUS_PROGRESS_NAME = '진행';
const CF_TASK_TYPE_NAME   = '태스크 구분';
const CF_EVENT_TYPE_NAME  = '이벤트 구분';
const TASK_TYPE_NAME_MD     = 'MD';
const TASK_TYPE_NAME_PC     = '포토카드';
const TASK_TYPE_NAME_UPDATE = '업데이트';
const TASK_TYPE_NAME_OPEN   = '오픈';
const TASK_TYPE_NAME_VMD    = 'VMD';
const TASK_TYPE_NAME_ETC    = '기타';

const EXCLUDE_KEYWORDS_PC = ['참석권', '관람권', '앨범', '이벤트', '키링', '폴라로이드', '포스트잇'];

const BENEFIT_KEYWORDS = [
  '키링', '뱃지', '카드', '엽서', 'L홀더', '우표',
  '인화 2컷', '인화 4컷', '증명사진', '탑로더', '볼펜',
  '골 트래커', '골트래커', '메시지 카드', '스티커', '메모지', '시험지'
];

const EXCLUDE_PATTERNS_BENEFIT = [
  /한\s*주문\s*건에서.*구매\s*시/i,
  /중복\s*없이.*세트\s*증정/i,
  /추가\s*증정/i
];

const HANDWRITING_KEYWORDS = [
  '부적', '상장', '탐정', '메시지', '생일', '프리쿠라',
  '메세지', '낙서', '행운'
];


// ── 메뉴 ──────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Asana 태스크 만들기')
    .addItem('🚀 태스크 생성', 'runAllAutomation')
    .addSeparator()
    .addItem('⚙️ 연결 테스트', 'testAsanaConnection')
    .addToUi();
}


// ── 메인 실행 ─────────────────────────────────────────────────

function runAllAutomation() {
  var ui = SpreadsheetApp.getUi();

  if (!ASANA_TOKEN || ASANA_TOKEN.length < 10) {
    ui.alert('⚠️ 설정 필요', 'ASANA_TOKEN을 입력해주세요.', ui.ButtonSet.OK);
    return;
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var allValues = sheet.getDataRange().getValues();
  var allDisplay = sheet.getDataRange().getDisplayValues();

  var productCode = getProductCode_(allValues);
  if (!productCode) {
    ui.alert('❌ 상품코드 없음', '시트에서 상품코드를 찾지 못했습니다.', ui.ButtonSet.OK);
    return;
  }

  var sheetData = buildSheetData_(allValues, allDisplay);
  var photocards = parsePhotocards_(sheetData);
  var benefits = parseBenefits_(sheetData);
  var openContext = buildOpenContext_(sheet, sheetData, productCode);
  var sectionName = buildSectionName_(sheetData, productCode);
  var projectOptions = getAvailableProjectOptions_();

  var pcTotal = photocards.reduce(function(sum, item) { return sum + item.count; }, 0);
  var spTotal = benefits.reduce(function(sum, item) { return sum + item.count; }, 0);

  showPreviewDialog_(productCode, sectionName, photocards, pcTotal, benefits, spTotal, openContext, projectOptions, sheetData);
}


/**
 * 시트 데이터를 한 번만 읽어 구조화
 * rows: 전체 행 배열 (values)
 * displayRows: 전체 행 배열 (displayValues)
 * benefitRows: 메이크스타 특전 이후 행만 (파싱 범위 제한용)
 * benefitDisplayRows: 메이크스타 특전 이후 표시값
 * fullText: 전체 텍스트
 * benefitText: 특전 섹션 이후 텍스트
 * eventTitleB1: B1 이벤트명
 * eventSourceText: 이벤트 판정용 텍스트 (B1 우선, 비면 전체 텍스트)
 */
function buildSheetData_(allValues, allDisplay) {
  var specialIdx = -1;
  for (var i = 0; i < allValues.length; i++) {
    if (allValues[i].join(' ').indexOf('메이크스타 특전') !== -1) {
      specialIdx = i;
      break;
    }
  }

  var benefitRows = specialIdx >= 0 ? allValues.slice(specialIdx) : [];
  var benefitDisplayRows = specialIdx >= 0 ? allDisplay.slice(specialIdx) : [];
  var fullText = allDisplay.map(function(row) { return row.join(' '); }).join('\n');
  var benefitText = benefitDisplayRows.map(function(row) { return row.join(' '); }).join('\n');
  var eventTitleB1 = '';

  if (allDisplay.length > 0 && allDisplay[0].length > 1) {
    eventTitleB1 = String(allDisplay[0][1] || '').trim();
  }

  return {
    rows: allValues,
    displayRows: allDisplay,
    benefitRows: benefitRows,
    benefitDisplayRows: benefitDisplayRows,
    fullText: fullText,
    benefitText: benefitText,
    specialIdx: specialIdx,
    eventTitleB1: eventTitleB1,
    eventSourceText: eventTitleB1 || fullText
  };
}


// ── 미리보기 다이얼로그 ────────────────────────────────────────

function showPreviewDialog_(productCode, sectionName, photocards, pcTotal, benefits, spTotal, openContext, projectOptions, sheetData) {
  var hasMd        = photocards.length > 0 || benefits.length > 0;
  var createVmd    = shouldCreateVmdTask_(openContext.eventLabels);
  var createWinner = shouldCreateWinnerAnnouncementTask_(openContext.eventLabels);
  var outputCount  = photocards.length + benefits.length;
  var parentKeys   = ['winner', 'vmd', 'md', 'up', 'open'];
  var dueSummaryText = buildDueSummaryText_(sheetData);

  var taskRows = [];

  if (createWinner) taskRows.push({ key: 'winner', label: '당첨자 선정', name: '[' + productCode + '] 당첨자 선정', indent: 0, isParent: true });
  if (createVmd) taskRows.push({ key: 'vmd', label: 'VMD', name: '[' + productCode + '] VMD', indent: 0, isParent: true });
  if (hasMd) {
    taskRows.push({ key: 'md', label: 'MD', name: '[' + productCode + '] MD', indent: 0, isParent: true });
    taskRows.push({ key: 'pc', label: '└ 포토카드', name: '[' + productCode + '] 포토카드 / ' + photocards.length + '세트 총' + pcTotal + '종', indent: 1, parentKey: 'md' });
    taskRows.push({ key: 'sp', label: '└ 특전', name: '[' + productCode + '] 특전 / ' + benefits.length + '종 총' + spTotal + '종', indent: 1, parentKey: 'md' });
    taskRows.push({ key: 'up', label: '업데이트', name: '[' + productCode + '] 업데이트', indent: 0, isParent: true });
    taskRows.push({ key: 'upsub', label: '└ 업데이트 상세', name: '[' + productCode + '] 업데이트 / ' + outputCount + '종', indent: 1, parentKey: 'up' });
  }
  taskRows.push({ key: 'open', label: '오픈', name: '[' + productCode + '] 오픈', indent: 0, isParent: true });
  taskRows.push({ key: 'opendesign', label: '└ 오픈 디자인', name: '[' + productCode + '] 오픈 디자인', indent: 1, parentKey: 'open' });

  var rowsHtml = taskRows.map(function(row) {
    var style = row.indent ? 'padding-left:20px;color:#555;' : 'font-weight:500;';
    var checkboxHtml = row.isParent
      ? '<input type="checkbox" id="c_' + row.key + '" checked style="transform:translateY(1px);">'
      : '';
    var rowClass = row.isParent ? 'task-parent' : 'task-child child-of-' + row.parentKey;
    return '<tr>' +
      '<td class="' + rowClass + '" style="' + style + 'padding:6px 8px;white-space:nowrap;">' + checkboxHtml + (checkboxHtml ? ' ' : '') + escapeHtml_(row.label) + '</td>' +
      '<td style="padding:4px;"><input type="text" id="t_' + row.key + '" value="' + escapeHtml_(row.name) + '" style="width:100%;border:1px solid #ddd;border-radius:4px;padding:5px 8px;font-size:13px;box-sizing:border-box;"></td>' +
      '</tr>';
  }).join('');

  var keysList = taskRows.map(function(row) { return '"' + row.key + '"'; }).join(',');
  var parentKeysList = parentKeys
    .filter(function(key) {
      return taskRows.some(function(row) { return row.key === key && row.isParent; });
    })
    .map(function(key) { return '"' + key + '"'; })
    .join(',');
  var childRowsJson = JSON.stringify(taskRows.filter(function(row) { return row.parentKey; }).map(function(row) {
    return { key: row.key, parentKey: row.parentKey };
  }));
  var projectOptionsHtml = (projectOptions || []).map(function(project) {
    var selected = String(project.gid) === String(TESTFARM_GID) ? ' selected' : '';
    return '<option value="' + escapeHtml_(project.gid) + '"' + selected + '>' + escapeHtml_(project.name) + '</option>';
  }).join('');

  var html =
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
    'body{font-family:sans-serif;font-size:13px;margin:0;padding:16px;background:#fafafa;}' +
    'h3{margin:0 0 12px;font-size:15px;}' +
    '.sr{display:flex;align-items:center;gap:8px;margin-bottom:14px;}' +
    '.sr label{white-space:nowrap;font-weight:500;}' +
    '.sr input{flex:1;border:1px solid #ddd;border-radius:4px;padding:6px 8px;font-size:13px;}' +
    'table{width:100%;border-collapse:collapse;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);}' +
    'th{background:#f0f0f0;text-align:left;padding:7px 8px;font-size:12px;color:#555;border-bottom:1px solid #e0e0e0;}' +
    'tr:not(:last-child) td{border-bottom:1px solid #f0f0f0;}' +
    '.footer{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;}' +
    'button{padding:8px 18px;border-radius:5px;border:none;cursor:pointer;font-size:13px;}' +
    '.bc{background:#eee;color:#333;}' +
    '.bs{background:#4a90e2;color:#fff;font-weight:500;}' +
    '.info{font-size:12px;color:#888;margin-bottom:10px;white-space:pre-line;}' +
    '.sr select{flex:1;border:1px solid #ddd;border-radius:4px;padding:6px 8px;font-size:13px;background:#fff;}' +
    '.row-disabled{opacity:.45;}' +
    '</style></head><body>' +
    '<h3>📋 태스크 생성 미리보기</h3>' +
    '<div class="sr"><label>Asana Project</label><select id="projectGid">' + projectOptionsHtml + '</select></div>' +
    '<div class="sr"><label>섹션명</label><input type="text" id="sectionName" value="' + escapeHtml_(sectionName) + '"></div>' +
    '<p class="info">이벤트명(B1): ' + escapeHtml_(openContext.eventSourceText || '(비어 있음)') + '\n이벤트 구분: ' + escapeHtml_(openContext.eventLabels.join(', ')) + '\n마감일 규칙(KST)\n' + escapeHtml_(dueSummaryText) + '\n프로젝트를 바꾸면 해당 프로젝트에 같은 커스텀필드가 있어야 정상 동작합니다.</p>' +
    '<table><thead><tr><th>태스크</th><th>제목 (수정 가능)</th></tr></thead><tbody>' + rowsHtml + '</tbody></table>' +
    '<div class="footer">' +
      '<button class="bc" onclick="google.script.host.close()">취소</button>' +
      '<button class="bs" id="btnCreate" onclick="onSubmit()">생성하기 →</button>' +
    '</div>' +
    '<script>' +
    'var CHILD_ROWS=' + childRowsJson + ';' +
    'function syncParentState(parentKey){' +
      'var checkbox=document.getElementById("c_"+parentKey);' +
      'if(!checkbox) return;' +
      'var enabled=checkbox.checked;' +
      'var parentInput=document.getElementById("t_"+parentKey);' +
      'if(parentInput) parentInput.disabled=!enabled;' +
      'var parentRowCell=checkbox.closest("td");' +
      'if(parentRowCell) parentRowCell.classList.toggle("row-disabled", !enabled);' +
      'CHILD_ROWS.filter(function(row){return row.parentKey===parentKey;}).forEach(function(row){' +
        'var input=document.getElementById("t_"+row.key);' +
        'if(input) input.disabled=!enabled;' +
        'var labelCell=input ? input.closest("tr").children[0] : null;' +
        'if(labelCell) labelCell.classList.toggle("row-disabled", !enabled);' +
      '});' +
    '}' +
    'function initParentStates(){' +
      '[' + parentKeysList + '].forEach(function(parentKey){' +
        'var checkbox=document.getElementById("c_"+parentKey);' +
        'if(!checkbox) return;' +
        'checkbox.addEventListener("change", function(){ syncParentState(parentKey); });' +
        'syncParentState(parentKey);' +
      '});' +
    '}' +
    'function onSubmit(){' +
      'var data={sectionName:document.getElementById("sectionName").value,projectGid:document.getElementById("projectGid").value};' +
      '[' + parentKeysList + '].forEach(function(parentKey){var checkbox=document.getElementById("c_"+parentKey);if(checkbox)data["enabled_"+parentKey]=checkbox.checked;});' +
      '[' + keysList + '].forEach(function(k){var el=document.getElementById("t_"+k);if(el)data[k]=el.value;});' +
      'document.getElementById("btnCreate").disabled=true;' +
      'document.getElementById("btnCreate").textContent="생성 중...";' +
      'google.script.run' +
        '.withSuccessHandler(function(){google.script.host.close();})' +
        '.withFailureHandler(function(e){alert("오류: "+e.message);document.getElementById("btnCreate").disabled=false;document.getElementById("btnCreate").textContent="생성하기 →";})' +
        '.executeCreateFromDialog(data);' +
    '}' +
    'initParentStates();' +
    '<\/script></body></html>';

  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(620).setHeight(520),
    '태스크 생성 미리보기'
  );
}


function executeCreateFromDialog(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var allValues = sheet.getDataRange().getValues();
  var allDisplay = sheet.getDataRange().getDisplayValues();
  var sheetData = buildSheetData_(allValues, allDisplay);
  var targetProjectGid = isValidGid_(data.projectGid) ? String(data.projectGid) : TESTFARM_GID;
  var enabledWinner = data.enabled_winner !== false;
  var enabledVmd = data.enabled_vmd !== false;
  var enabledMd = data.enabled_md !== false;
  var enabledUp = data.enabled_up !== false;
  var enabledOpen = data.enabled_open !== false;

  var productCode = getProductCode_(allValues);
  if (!productCode) {
    throw new Error('상품코드를 찾지 못했습니다.');
  }

  var photocards = parsePhotocards_(sheetData);
  var benefits = parseBenefits_(sheetData);
  var openContext = buildOpenContext_(sheet, sheetData, productCode);

  var pcTotal = photocards.reduce(function(sum, item) { return sum + item.count; }, 0);
  var spTotal = benefits.reduce(function(sum, item) { return sum + item.count; }, 0);
  var hasMd = photocards.length > 0 || benefits.length > 0;
  var createVmd = shouldCreateVmdTask_(openContext.eventLabels);
  var createWinner = shouldCreateWinnerAnnouncementTask_(openContext.eventLabels);
  Logger.log(buildDueSummaryText_(sheetData));

  var sectionGid = getOrCreateSection_(targetProjectGid, data.sectionName || buildSectionName_(sheetData, productCode));

  if (createWinner && enabledWinner) createWinnerAnnouncementTask_(productCode, openContext, targetProjectGid, sectionGid, data.winner);
  if (createVmd && enabledVmd) createVmdTask_(productCode, openContext, sheetData, targetProjectGid, sectionGid, data.vmd);
  if (hasMd) {
    if (enabledMd) {
      createMdTasks_(productCode, photocards, pcTotal, benefits, spTotal, sheetData, targetProjectGid, sectionGid, data);
    }
    if (enabledUp) {
      createUpdateTasks_(productCode, photocards, benefits, sheetData, targetProjectGid, sectionGid, data);
    }
  }
  if (enabledOpen) {
    createOpenTasks_(productCode, openContext, sheetData, targetProjectGid, sectionGid, data);
  }

  SpreadsheetApp.getUi().alert(
    '🎉 생성 완료',
    '태스크가 생성됐습니다.\nhttps://app.asana.com/0/' + targetProjectGid,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}


// ── 섹션명 ────────────────────────────────────────────────────

function buildSectionName_(sheetData, productCode) {
  return parseEventStartDate_(sheetData) + ' ' + productCode;
}

function parseEventStartDate_(sheetData) {
  var datePattern = /(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/;
  for (var i = 0; i < sheetData.displayRows.length; i++) {
    var rowText = sheetData.displayRows[i].join(' ');
    if (/(응모.*기간|응모기간|시작일)/.test(rowText)) {
      var match = rowText.match(datePattern);
      if (match) {
        return String(parseInt(match[2], 10)).padStart(2, '0') + '/' + String(parseInt(match[3], 10)).padStart(2, '0');
      }
    }
  }

  var today = new Date();
  return String(today.getMonth() + 1).padStart(2, '0') + '/' + String(today.getDate()).padStart(2, '0');
}


// ══════════════════════════════════════════════════════════════
//  MD 태스크 생성
// ══════════════════════════════════════════════════════════════

function createMdTasks_(productCode, photocards, pcTotal, benefits, spTotal, sheetData, targetProjectGid, sectionGid, names) {
  var dueFields  = getTaskDueFields_(sheetData, 'md');
  var mdName     = names.md || '[' + productCode + '] MD';
  var pcTaskName = names.pc || '[' + productCode + '] 포토카드 / ' + photocards.length + '세트 총' + pcTotal + '종';
  var spTaskName = names.sp || '[' + productCode + '] 특전 / ' + benefits.length + '종 총' + spTotal + '종';
  var statusFieldGid = getStatusFieldGid_(targetProjectGid);
  var progressOptionGid = getStatusOptionGidByName_(CF_STATUS_PROGRESS_NAME, targetProjectGid);
  var taskTypeFieldGid = getTaskTypeFieldGid_(targetProjectGid);
  var mdOptionGid = getTaskTypeOptionGidByName_(TASK_TYPE_NAME_MD, targetProjectGid);
  var pcOptionGid = getTaskTypeOptionGidByName_(TASK_TYPE_NAME_PC, targetProjectGid);

  var cfMd = {};
  applyRequiredEnumCustomField_(cfMd, statusFieldGid, progressOptionGid, CF_STATUS_NAME, CF_STATUS_PROGRESS_NAME, targetProjectGid);
  applyRequiredEnumCustomField_(cfMd, taskTypeFieldGid, mdOptionGid, CF_TASK_TYPE_NAME, TASK_TYPE_NAME_MD, targetProjectGid);

  var mdPayload = {
    name: mdName,
    projects: [targetProjectGid],
    assignee: ASSIGNEE_GID,
    notes: '발주 후 "완료" 처리 부탁드립니다!',
    followers: [ASSIGNEE_GID],
    custom_fields: cfMd
  };
  applyDueFields_(mdPayload, dueFields);
  var mdGid = createTask_(mdPayload);
  addTaskToSection_(mdGid, sectionGid);

  if (photocards.length > 0) {
    var cfPc = {};
    applyRequiredEnumCustomField_(cfPc, taskTypeFieldGid, pcOptionGid, CF_TASK_TYPE_NAME, TASK_TYPE_NAME_PC, targetProjectGid);
    var pcPayload = {
      name: pcTaskName,
      parent: mdGid,
      assignee: ASSIGNEE_GID,
      html_notes: buildPhotocardDescription_(photocards),
      followers: [ASSIGNEE_GID],
      custom_fields: cfPc
    };
    applyDueFields_(pcPayload, dueFields);
    createTask_(pcPayload);
  }

  if (benefits.length > 0) {
    var cfSp = {};
    applyRequiredEnumCustomField_(cfSp, taskTypeFieldGid, mdOptionGid, CF_TASK_TYPE_NAME, TASK_TYPE_NAME_MD, targetProjectGid);
    var spPayload = {
      name: spTaskName,
      parent: mdGid,
      assignee: ASSIGNEE_GID,
      html_notes: buildBenefitDescription_(benefits),
      followers: [ASSIGNEE_GID],
      custom_fields: cfSp
    };
    applyDueFields_(spPayload, dueFields);
    createTask_(spPayload);
  }
}


// ══════════════════════════════════════════════════════════════
//  업데이트 태스크 생성
// ══════════════════════════════════════════════════════════════

function createUpdateTasks_(productCode, photocards, benefits, sheetData, targetProjectGid, sectionGid, names) {
  var dueFields   = getTaskDueFields_(sheetData, 'update');
  var outputCount = photocards.length + benefits.length;
  var upName      = names.up || '[' + productCode + '] 업데이트';
  var upSubName   = names.upsub || '[' + productCode + '] 업데이트 / ' + outputCount + '종';
  var statusFieldGid = getStatusFieldGid_(targetProjectGid);
  var progressOptionGid = getStatusOptionGidByName_(CF_STATUS_PROGRESS_NAME, targetProjectGid);
  var taskTypeFieldGid = getTaskTypeFieldGid_(targetProjectGid);
  var updateOptionGid = getTaskTypeOptionGidByName_(TASK_TYPE_NAME_UPDATE, targetProjectGid);

  var cfUp = {};
  applyRequiredEnumCustomField_(cfUp, statusFieldGid, progressOptionGid, CF_STATUS_NAME, CF_STATUS_PROGRESS_NAME, targetProjectGid);
  applyRequiredEnumCustomField_(cfUp, taskTypeFieldGid, updateOptionGid, CF_TASK_TYPE_NAME, TASK_TYPE_NAME_UPDATE, targetProjectGid);

  var upPayload = {
    name: upName,
    projects: [targetProjectGid],
    assignee: ASSIGNEE_GID,
    notes: 'SNS 발행 후 "완료" 처리 부탁드립니다!',
    followers: [ASSIGNEE_GID],
    custom_fields: cfUp
  };
  applyDueFields_(upPayload, dueFields);
  var upGid = createTask_(upPayload);
  addTaskToSection_(upGid, sectionGid);

  var cfUpSub = {};
  applyRequiredEnumCustomField_(cfUpSub, taskTypeFieldGid, updateOptionGid, CF_TASK_TYPE_NAME, TASK_TYPE_NAME_UPDATE, targetProjectGid);
  var upSubPayload = {
    name: upSubName,
    parent: upGid,
    assignee: ASSIGNEE_GID,
    html_notes: buildUpdateDescription_(photocards, benefits),
    followers: [ASSIGNEE_GID],
    custom_fields: cfUpSub
  };
  applyDueFields_(upSubPayload, dueFields);
  createTask_(upSubPayload);
}


// ══════════════════════════════════════════════════════════════
//  오픈 태스크 생성
// ══════════════════════════════════════════════════════════════

function createOpenTasks_(productCode, openContext, sheetData, targetProjectGid, sectionGid, names) {
  var dueFields      = getTaskDueFields_(sheetData, 'open');
  var openName       = names.open || '[' + productCode + '] 오픈';
  var openDesignName = names.opendesign || '[' + productCode + '] 오픈 디자인';
  var openOptionGid  = getTaskTypeOptionGidByName_(TASK_TYPE_NAME_OPEN, targetProjectGid);
  var statusFieldGid = getStatusFieldGid_(targetProjectGid);
  var progressOptionGid = getStatusOptionGidByName_(CF_STATUS_PROGRESS_NAME, targetProjectGid);
  var taskTypeFieldGid = getTaskTypeFieldGid_(targetProjectGid);

  var cfOpen = {};
  applyRequiredEnumCustomField_(cfOpen, statusFieldGid, progressOptionGid, CF_STATUS_NAME, CF_STATUS_PROGRESS_NAME, targetProjectGid);
  applyRequiredEnumCustomField_(cfOpen, taskTypeFieldGid, openOptionGid, CF_TASK_TYPE_NAME, TASK_TYPE_NAME_OPEN, targetProjectGid);

  var openPayload = {
    name: openName,
    projects: [targetProjectGid],
    assignee: ASSIGNEE_GID,
    notes: '페이지 작업 후 "완료" 처리 부탁드립니다!',
    followers: [ASSIGNEE_GID],
    custom_fields: cfOpen
  };
  applyDueFields_(openPayload, dueFields);
  var openGid = createTask_(openPayload);
  addTaskToSection_(openGid, sectionGid);
  setEventFieldOnTask_(openGid, openContext.eventLabels, targetProjectGid);

  var cfOd = {};
  applyRequiredEnumCustomField_(cfOd, taskTypeFieldGid, openOptionGid, CF_TASK_TYPE_NAME, TASK_TYPE_NAME_OPEN, targetProjectGid);

  var odPayload = {
    name: openDesignName,
    parent: openGid,
    assignee: ASSIGNEE_GID,
    html_notes: buildOpenDescription_(openContext),
    followers: [ASSIGNEE_GID],
    custom_fields: cfOd
  };
  applyDueFields_(odPayload, dueFields);
  var odGid = createTask_(odPayload);
  setEventFieldOnTask_(odGid, openContext.eventLabels, targetProjectGid);
}


// ══════════════════════════════════════════════════════════════
//  VMD 태스크 생성
// ══════════════════════════════════════════════════════════════

function createVmdTask_(productCode, openContext, sheetData, targetProjectGid, sectionGid, nameOverride) {
  var dueFields    = getTaskDueFields_(sheetData, 'vmd');
  var vmdName      = nameOverride || '[' + productCode + '] VMD';
  var vmdChildName = '[' + productCode + '] VMD / (' + openContext.vmdItemCount + ')종';
  var vmdOptionGid = getTaskTypeOptionGidByName_(TASK_TYPE_NAME_VMD, targetProjectGid);
  var statusFieldGid = getStatusFieldGid_(targetProjectGid);
  var progressOptionGid = getStatusOptionGidByName_(CF_STATUS_PROGRESS_NAME, targetProjectGid);
  var taskTypeFieldGid = getTaskTypeFieldGid_(targetProjectGid);

  var cfV = {};
  applyRequiredEnumCustomField_(cfV, statusFieldGid, progressOptionGid, CF_STATUS_NAME, CF_STATUS_PROGRESS_NAME, targetProjectGid);
  applyRequiredEnumCustomField_(cfV, taskTypeFieldGid, vmdOptionGid, CF_TASK_TYPE_NAME, TASK_TYPE_NAME_VMD, targetProjectGid);

  var cfVc = {};
  applyRequiredEnumCustomField_(cfVc, taskTypeFieldGid, vmdOptionGid, CF_TASK_TYPE_NAME, TASK_TYPE_NAME_VMD, targetProjectGid);

  var vmdPayload = {
    name: vmdName,
    projects: [targetProjectGid],
    assignee: ASSIGNEE_GID,
    notes: '발주 후 "완료" 처리 부탁드립니다!',
    followers: [ASSIGNEE_GID],
    custom_fields: cfV
  };
  applyDueFields_(vmdPayload, dueFields);
  var vmdGid = createTask_(vmdPayload);
  addTaskToSection_(vmdGid, sectionGid);

  var vmdChildPayload = {
    name: vmdChildName,
    parent: vmdGid,
    assignee: ASSIGNEE_GID,
    html_notes: buildVmdDescription_(openContext),
    followers: [ASSIGNEE_GID],
    custom_fields: cfVc
  };
  applyDueFields_(vmdChildPayload, dueFields);
  createTask_(vmdChildPayload);
}


// ══════════════════════════════════════════════════════════════
//  당첨자 선정 태스크 생성
// ══════════════════════════════════════════════════════════════

function createWinnerAnnouncementTask_(productCode, openContext, targetProjectGid, sectionGid, nameOverride) {
  var dueDate      = getDueDate_(DUE_DAYS_OFFSET);
  var winnerName   = nameOverride || '[' + productCode + '] 당첨자 선정';
  var etcOptionGid = getTaskTypeOptionGidByName_(TASK_TYPE_NAME_ETC, targetProjectGid);
  var statusFieldGid = getStatusFieldGid_(targetProjectGid);
  var progressOptionGid = getStatusOptionGidByName_(CF_STATUS_PROGRESS_NAME, targetProjectGid);
  var taskTypeFieldGid = getTaskTypeFieldGid_(targetProjectGid);

  var cfW = {};
  applyRequiredEnumCustomField_(cfW, statusFieldGid, progressOptionGid, CF_STATUS_NAME, CF_STATUS_PROGRESS_NAME, targetProjectGid);
  applyRequiredEnumCustomField_(cfW, taskTypeFieldGid, etcOptionGid, CF_TASK_TYPE_NAME, TASK_TYPE_NAME_ETC, targetProjectGid);

  var winnerGid = createTask_({
    name: winnerName,
    projects: [targetProjectGid],
    assignee: ASSIGNEE_GID,
    due_on: dueDate,
    notes: '당첨자 관련 업무 스케줄링을 위한 태스크입니다!',
    custom_fields: cfW
  });
  addTaskToSection_(winnerGid, sectionGid);
}


// ══════════════════════════════════════════════════════════════
//  설명 HTML 빌더
// ══════════════════════════════════════════════════════════════

function buildPhotocardDescription_(photocards) {
  var html = '<body><em>*더 필요한 산출물은 추가, 사용하지 않는 산출물은 삭제해주세요!</em>';
  for (var i = 0; i < photocards.length; i++) {
    var pc = photocards[i];
    var hw = hasKeyword_(pc.name, HANDWRITING_KEYWORDS) ? 'O' : 'X';
    html += '\n\n<strong>' + pc.name + ' (' + pc.count + '종)</strong><ol>';
    html += '<li>스펙<ol type="a"><li>(55*85가 아닐 경우, 주문 상세 페이지 URL 또는 스펙 공유)</li></ol></li>';
    html += '<li>문의<ol type="a"><li>손그림, 글씨 사용 여부 : ' + hw + '</li></ol></li>';
    html += '<li>자료<ol type="a"><li>URL 또는 MAS 위치</li></ol></li>';
    html += '<li>공유, 요청<ol type="a"><li>소속사 요청 사항, 디자인 컨셉, 아이디어 등 공유가 필요한 내용을 편하게 남겨주세요!</li></ol></li>';
    html += '</ol>';
  }
  return html + '</body>';
}

function buildBenefitDescription_(benefits) {
  var html = '<body><em>*더 필요한 산출물은 추가, 사용하지 않는 산출물은 삭제해주세요!</em>';
  for (var i = 0; i < benefits.length; i++) {
    var b = benefits[i];
    var hw = hasKeyword_(b.name, HANDWRITING_KEYWORDS) ? 'O' : 'X';
    html += '\n\n<strong>' + b.name + ' (' + b.count + '종)</strong><ol>';
    html += '<li>스펙<ol type="a"><li>주문 상세 페이지 URL</li><li>(또는 상품 스펙)</li></ol></li>';
    html += '<li>문의<ol type="a"><li>손그림, 글씨 사용 여부 : ' + hw + '</li></ol></li>';
    html += '<li>자료<ol type="a"><li>URL 또는 MAS 위치</li></ol></li>';
    html += '<li>공유, 요청<ol type="a"><li>소속사 요청 사항, 디자인 컨셉, 아이디어 등 공유가 필요한 내용을 편하게 남겨주세요!</li></ol></li>';
    html += '</ol>';
  }
  return html + '</body>';
}

function buildUpdateDescription_(photocards, benefits) {
  var html = '<body><strong>자료</strong><ol><li>URL 또는 MAS 위치</li></ol>';
  html += '\n\n<strong>문의</strong><ol><li>블러 강도 <strong>(3)</strong>단계</li><li>(자료 수급 일정)</li></ol>';
  html += '\n\n<strong>공유, 요청</strong><ol><li>소속사 요청 사항, 디자인 컨셉, 아이디어 등 공유가 필요한 내용을 편하게 남겨주세요!</li></ol>';

  var items = [];
  for (var i = 0; i < photocards.length; i++) items.push('<li>' + photocards[i].name + ' (' + photocards[i].count + '종)</li>');
  for (var j = 0; j < benefits.length; j++) items.push('<li>' + benefits[j].name + ' (' + benefits[j].count + '종)</li>');

  if (items.length > 0) {
    html += '\n\n<strong>필요한 산출물</strong><ol>' + items.join('') + '</ol>';
    html += '\n\n<em>*더 필요한 산출물은 추가, 사용하지 않는 산출물은 삭제해주세요!</em>';
  }
  return html + '</body>';
}

function buildOpenDescription_(openContext) {
  var outputItems = [
    '<li>메인 배너 (PC)</li>',
    '<li>메인 배너 (모바일)</li>',
    '<li>서브 배너</li>',
    '<li>스토리 ' + openContext.storyCount + '종</li>'
  ];
  if (openContext.includePackshot) outputItems.push('<li>팩샷</li>');

  var snsHtml = '<li>SNS ' + openContext.snsItems.length + '종 / <a href="' + openContext.planningUrl + '">URL &gt;</a><ol type="a">';
  for (var i = 0; i < openContext.snsItems.length; i++) snsHtml += '<li>' + openContext.snsItems[i] + '</li>';
  snsHtml += '</ol></li>';
  outputItems.push(snsHtml);

  return '<body>' + [
    '<em>*불필요한 내용은 삭제하셔도 좋습니다!</em>',
    '<strong>기획서</strong><ol><li><a href="' + openContext.planningUrl + '">URL &gt;</a></li></ol>',
    '<strong>자료</strong><ol><li>URL 또는 MAS 위치</li></ol>',
    '<strong>문의</strong><ol><li>통이미지 작업 필요 여부 : ' + openContext.compositeImageNeeded + '</li></ol>',
    '<strong>공유, 요청</strong><ol><li>소속사 요청 사항, 디자인 컨셉, 아이디어 등 공유가 필요한 내용을 편하게 남겨주세요!</li></ol>',
    '<strong>필요한 산출물</strong><ol>' + outputItems.join('') + '</ol>',
    '<em>*더 필요한 산출물을 추가, 사용하지 않는 산출물은 삭제해주세요!</em>'
  ].join('\n') + '</body>';
}

function buildVmdDescription_(openContext) {
  var html = '<body><em>*더 필요한 산출물은 추가, 사용하지 않는 산출물은 삭제해주세요!</em>';
  for (var i = 0; i < openContext.vmdItemCount; i++) {
    var label = String.fromCharCode('A'.charCodeAt(0) + i);
    html += '\n\n<strong>항목 ' + label + '</strong><ol>';
    html += '<li>스펙<ol type="a"><li>주문 상세 페이지 URL</li><li>(또는 상품 스펙)</li></ol></li>';
    html += '<li>문의<ol type="a"><li>손그림, 글씨 사용 여부 : X</li></ol></li>';
    html += '<li>자료<ol type="a"><li>URL 또는 MAS 위치</li></ol></li>';
    html += '<li>공유, 요청<ol type="a"><li>소속사 요청 사항, 디자인 컨셉, 아이디어 등 공유가 필요한 내용을 편하게 남겨주세요!</li></ol></li>';
    html += '</ol>';
  }
  return html + '</body>';
}


// ══════════════════════════════════════════════════════════════
//  시트 파싱
// ══════════════════════════════════════════════════════════════

function buildOpenContext_(sheet, sheetData, productCode) {
  var eventLabels = detectOpenEvents_(sheetData.eventSourceText);
  var storyCount  = countOpenStoryItems_(sheetData);

  return {
    planningUrl:          sheet.getParent().getUrl() + '#gid=' + sheet.getSheetId(),
    storyCount:           storyCount,
    vmdItemCount:         VMD_FIXED_ITEM_COUNT,
    compositeImageNeeded: '확인 필요',
    eventLabels:          eventLabels,
    includePackshot:      true,
    snsItems:             buildOpenSnsItems_(sheetData.fullText, eventLabels),
    eventSourceText:      sheetData.eventSourceText
  };
}

function getProductCode_(allValues) {
  for (var i = 0; i < allValues.length; i++) {
    for (var j = 0; j < allValues[i].length; j++) {
      var cell = String(allValues[i][j]).trim();
      if (cell === '상품코드' && j + 1 < allValues[i].length) {
        var code = String(allValues[i][j + 1]).trim();
        if (code) return code;
      }
      var match = cell.match(/^(P_\d+[A-Z0-9_]*)$/i);
      if (match) return match[1];
    }
  }
  return null;
}

function parsePhotocards_(sheetData) {
  var results = [];
  var seen = {};
  var rows = sheetData.benefitRows;

  for (var i = 0; i < rows.length; i++) {
    for (var j = 0; j < rows[i].length; j++) {
      var cell = String(rows[i][j]).trim();
      if (!cell || cell.indexOf('포토카드') === -1) continue;

      var excluded = false;
      for (var k = 0; k < EXCLUDE_KEYWORDS_PC.length; k++) {
        if (cell.indexOf(EXCLUDE_KEYWORDS_PC[k]) !== -1) {
          excluded = true;
          break;
        }
      }
      if (excluded) continue;

      var countMatch = cell.match(/(\d+)\s*(?:매|종)/);
      if (!countMatch) continue;

      var count = parseInt(countMatch[1], 10);
      var name = cell
        .replace(/^\d+\.\s*/, '')
        .replace(/^[-•]\s*/, '')
        .replace(/\s*\d+\s*(?:매|종).*$/, '')
        .replace(/\s*\(.*?\)/g, '')
        .replace(/\s*-.*$/, '')
        .trim();

      if (!name || name.length < 3 || seen[name]) continue;

      seen[name] = true;
      results.push({ name: name, count: count });
    }
  }
  return results;
}

function parseBenefits_(sheetData) {
  var results = [];
  var seen = {};
  var rows = sheetData.benefitRows;

  for (var i = 0; i < rows.length; i++) {
    if (rows[i].join(' ').indexOf('유의사항') !== -1) break;

    for (var j = 0; j < rows[i].length; j++) {
      var cell = String(rows[i][j]).trim();
      if (!cell) continue;

      var benefitKeyword = findBenefitKeyword_(cell);
      if (!benefitKeyword) continue;
      if (cell.indexOf('포토카드') !== -1) continue;

      var item = extractBenefitItem_(cell, benefitKeyword);
      if (!item) continue;
      if (shouldExcludeBenefitCell_(cell, item.name, item.count)) continue;

      if (seen[item.name] !== undefined) {
        results[seen[item.name]].count += item.count;
      } else {
        seen[item.name] = results.length;
        results.push({ name: item.name, count: item.count });
      }
    }
  }
  return results;
}

function countOpenStoryItems_(sheetData) {
  var rows = sheetData.benefitDisplayRows;
  var count = 0;

  for (var i = 0; i < rows.length; i++) {
    if (rows[i].join(' ').indexOf('유의사항') !== -1) break;

    for (var j = 0; j < rows[i].length; j++) {
      var cell = String(rows[i][j] || '');
      if (!cell) continue;

      var lines = cell.split(/\r?\n/);
      for (var k = 0; k < lines.length; k++) {
        var line = lines[k].trim();
        if (isOpenStoryLine_(line)) {
          count++;
        }
      }
    }
  }
  return count;
}

function isOpenStoryLine_(line) {
  var raw = String(line || '').trim();
  if (!raw) return false;

  if (/^For\.\s*.+/i.test(raw)) {
    return true;
  }

  var normalized = raw
    .replace(/[★☆◆◇■□※]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return /^SPECIAL\s+(?:GIFT|EVENT)(?:\s+\d+)?$/i.test(normalized);
}

function detectOpenEvents_(text) {
  var normalized = normalizeOpenEventText_(text);
  var labels = [];

  if (/(증정|특전|포토카드|포카|온라인\s*럭키드로우|online\s*lucky\s*draw|스페셜\s*기프트|special\s*gift|benefit|photocard|gift)/i.test(normalized)) {
    pushUnique_(labels, '특전');
  }

  if (/(쇼케이스|showcase|초대|invite)/i.test(normalized)) {
    pushUnique_(labels, '쇼케이스 초대');
  }

  if (/(투샷회|two\s*shot|two-shot|2\s*shot|2-shot)/i.test(normalized)) {
    pushUnique_(labels, '투샷회');
  }

  var vcCount = countKeywordOccurrences_(normalized, /(영상통화|영통|video\s*call|video-call|videocall)/ig);
  if (vcCount >= 1) pushUnique_(labels, '영통 1');
  if (vcCount >= 2) pushUnique_(labels, '영통 2');

  if (/(팬사인회|팬미팅|대면|밋|meet|fansign|fanmeeting|fan\s*meeting|fan\s*sign)/i.test(normalized)) {
    pushUnique_(labels, '대면');
  }

  if (/(1\s*:\s*1\s*포토회|1대1\s*포토회|포토회|1\s*:\s*1\s*photo|1\s*to\s*1\s*photo|photo\s*event)/i.test(normalized)) {
    pushUnique_(labels, '포토');
  }

  if (/(베이커리|게임회|bakery|game\s*event|game\s*meeting)/i.test(normalized)) {
    pushUnique_(labels, '오프라인 이벤트');
  }

  if (/(오프라인\s*럭키드로우|offline\s*lucky\s*draw)/i.test(normalized)) {
    pushUnique_(labels, '오프라인 럭키드로우');
  }

  if (/(펀딩|funding)/i.test(normalized)) {
    pushUnique_(labels, '펀딩');
  }

  if (/(상품|기획전)/i.test(normalized)) {
    pushUnique_(labels, '일반 판매');
  }

  if (/(웨이디엔)/i.test(normalized)) {
    pushUnique_(labels, '파생');
  }

  if (labels.length === 0) labels.push('기타');

  return sortOpenEventLabels_(labels);
}

function buildOpenSnsItems_(fullText, eventLabels) {
  var items = ['메인'];
  if (String(fullText || '').indexOf('홍보 이벤트') !== -1) {
    items.push('홍보이벤트 / 국');
    items.push('홍보이벤트 / 영');
  }
  if (eventLabels.indexOf('대면') !== -1 || eventLabels.indexOf('쇼케이스 초대') !== -1) {
    items.push('이벤트 일정 안내');
  }
  if (eventLabels.length >= 2) {
    items.push('특전 / 이벤트 A');
    items.push('특전 / 이벤트 B');
  } else {
    items.push('특전');
  }
  return items;
}

function shouldExcludeBenefitCell_(cell, benefitName, count) {
  var normalized = String(cell).replace(/\s+/g, ' ').trim();
  var concretePattern = new RegExp(escapeRegExp_(benefitName) + '\\s*' + count + '\\s*(?:매|종|개)');

  if (concretePattern.test(normalized)) return false;

  for (var i = 0; i < EXCLUDE_PATTERNS_BENEFIT.length; i++) {
    if (EXCLUDE_PATTERNS_BENEFIT[i].test(normalized)) return true;
  }
  return false;
}

function extractBenefitItem_(cell, benefitKeyword) {
  var normalized = String(cell).replace(/\s+/g, ' ').trim();
  var escapedKeyword = escapeRegExp_(benefitKeyword);
  var match = normalized.match(new RegExp('(.{0,80}?' + escapedKeyword + ')\\s*(\\d+)\\s*(?:매|종|개)'));

  if (!match) return null;

  var name = match[1]
    .replace(/^\d+\.\s*/, '')
    .replace(/^[-•]\s*/, '')
    .replace(/.*(?:구매\s*시|특전\s*[:：]|증정품\s*[:：]|구성\s*[:：]|\/|,|·)\s*/, '')
    .replace(/\s*\(.*?\)\s*$/g, '')
    .trim();

  if (!name || name.length < 2) return null;

  return {
    name: name,
    count: parseInt(match[2], 10)
  };
}

function normalizeOpenEventText_(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[／]/g, '/')
    .replace(/[“”"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countKeywordOccurrences_(text, regex) {
  var matches = String(text).match(regex);
  return matches ? matches.length : 0;
}

function sortOpenEventLabels_(labels) {
  var order = ['특전', '쇼케이스 초대', '투샷회', '영통 1', '영통 2', '대면', '포토', '오프라인 이벤트', '오프라인 럭키드로우', '펀딩', '일반 판매', '파생', '기타'];
  var result = [];

  for (var i = 0; i < order.length; i++) {
    if (labels.indexOf(order[i]) !== -1) {
      result.push(order[i]);
    }
  }
  return result;
}

function shouldCreateVmdTask_(labels) {
  return ['쇼케이스 초대', '대면', '포토', '오프라인 이벤트', '오프라인 럭키드로우'].some(function(label) {
    return labels.indexOf(label) !== -1;
  });
}

function shouldCreateWinnerAnnouncementTask_(labels) {
  return !(labels.length === 1 && labels[0] === '특전');
}

function findBenefitKeyword_(text) {
  for (var i = 0; i < BENEFIT_KEYWORDS.length; i++) {
    if (text.indexOf(BENEFIT_KEYWORDS[i]) !== -1) return BENEFIT_KEYWORDS[i];
  }
  return null;
}

function hasKeyword_(text, keywords) {
  for (var i = 0; i < keywords.length; i++) {
    if (text.indexOf(keywords[i]) !== -1) return true;
  }
  return false;
}

function pushUnique_(arr, value) {
  if (arr.indexOf(value) === -1) arr.push(value);
}

function escapeRegExp_(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getAvailableProjectOptions_() {
  if (getAvailableProjectOptions_.cache) {
    return getAvailableProjectOptions_.cache;
  }

  var fallbackName = getProjectName_(TESTFARM_GID) || 'TESTFARM';
  var fallback = [{ gid: TESTFARM_GID, name: fallbackName }];

  try {
    var projectInfo = getProjectInfo_(TESTFARM_GID);
    var workspace = projectInfo.workspace || {};
    if (!isValidGid_(workspace.gid)) {
      getAvailableProjectOptions_.cache = fallback;
      return fallback;
    }

    var projects = asanaRequest_(
      'get',
      '/workspaces/' + workspace.gid + '/projects?archived=false&limit=100&opt_fields=name',
      null
    ) || [];

    var options = [];
    var seen = {};

    for (var i = 0; i < projects.length; i++) {
      var project = projects[i] || {};
      if (!isValidGid_(project.gid) || !project.name) continue;
      if (seen[project.gid]) continue;
      seen[project.gid] = true;
      options.push({ gid: String(project.gid), name: String(project.name) });
    }

    if (!seen[TESTFARM_GID]) {
      options.unshift({ gid: TESTFARM_GID, name: fallbackName });
    }

    options.sort(function(a, b) {
      if (a.gid === TESTFARM_GID) return -1;
      if (b.gid === TESTFARM_GID) return 1;
      return a.name.localeCompare(b.name);
    });

    getAvailableProjectOptions_.cache = options.length > 0 ? options : fallback;
    return getAvailableProjectOptions_.cache;
  } catch (e) {
    Logger.log('프로젝트 목록 조회 실패: ' + e.message);
    getAvailableProjectOptions_.cache = fallback;
    return fallback;
  }
}

function getProjectInfo_(projectGid) {
  if (!isValidGid_(projectGid)) return {};

  if (!getProjectInfo_.cache) {
    getProjectInfo_.cache = {};
  }
  if (getProjectInfo_.cache[projectGid]) {
    return getProjectInfo_.cache[projectGid];
  }

  var project = asanaRequest_(
    'get',
    '/projects/' + projectGid + '?opt_fields=name,workspace.gid,workspace.name',
    null
  );
  getProjectInfo_.cache[projectGid] = project || {};
  return getProjectInfo_.cache[projectGid];
}

function getProjectName_(projectGid) {
  var project = getProjectInfo_(projectGid);
  return project && project.name ? String(project.name) : '';
}

function getProjectCustomFieldMap_(projectGid) {
  var targetProjectGid = isValidGid_(projectGid) ? String(projectGid) : TESTFARM_GID;

  if (!getProjectCustomFieldMap_.cache) {
    getProjectCustomFieldMap_.cache = {};
  }
  if (getProjectCustomFieldMap_.cache[targetProjectGid]) {
    return getProjectCustomFieldMap_.cache[targetProjectGid];
  }

  var project = asanaRequest_(
    'get',
    '/projects/' + targetProjectGid + '?opt_fields=custom_field_settings.custom_field.name,custom_field_settings.custom_field.gid',
    null
  );

  var settings = project.custom_field_settings || [];
  var map = {};

  for (var i = 0; i < settings.length; i++) {
    var field = settings[i].custom_field || {};
    if (!field.name || !isValidGid_(field.gid)) continue;
    map[normalizeOptionLabel_(field.name)] = String(field.gid);
  }

  getProjectCustomFieldMap_.cache[targetProjectGid] = map;
  return map;
}


// ══════════════════════════════════════════════════════════════
//  Asana API 헬퍼
// ══════════════════════════════════════════════════════════════

function asanaRequest_(method, endpoint, payload) {
  var options = {
    method: method,
    headers: {
      'Authorization': 'Bearer ' + ASANA_TOKEN,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    muteHttpExceptions: true
  };

  if (payload !== null && method !== 'get' && method !== 'delete') {
    options.payload = JSON.stringify({ data: payload });
  }

  var response = UrlFetchApp.fetch('https://app.asana.com/api/1.0' + endpoint, options);
  var code = response.getResponseCode();

  if (code === 204) return null;

  var body = JSON.parse(response.getContentText());
  if (code < 200 || code >= 300) {
    var msg = (body.errors && body.errors[0]) ? body.errors[0].message : JSON.stringify(body);
    throw new Error('Asana API 오류 (' + code + '): ' + msg);
  }

  return body.data;
}

function createTask_(payload) {
  return asanaRequest_('post', '/tasks', payload).gid;
}

function createSection_(gid, name) {
  return asanaRequest_('post', '/projects/' + gid + '/sections', { name: name }).gid;
}

function getOrCreateSection_(projectGid, name) {
  var sections = asanaRequest_('get', '/projects/' + projectGid + '/sections', null);
  for (var i = 0; i < sections.length; i++) {
    if (sections[i].name === name) {
      moveSectionToTop_(projectGid, sections[i].gid, sections);
      return sections[i].gid;
    }
  }
  var sectionGid = createSection_(projectGid, name);
  moveSectionToTop_(projectGid, sectionGid, sections);
  return sectionGid;
}

function addTaskToSection_(taskGid, sectionGid) {
  asanaRequest_('post', '/sections/' + sectionGid + '/addTask', { task: taskGid });
}

function moveSectionToTop_(projectGid, sectionGid, sections) {
  if (!isValidGid_(projectGid) || !isValidGid_(sectionGid)) return;

  var sectionList = sections || asanaRequest_('get', '/projects/' + projectGid + '/sections', null) || [];
  var firstOtherSectionGid = '';

  for (var i = 0; i < sectionList.length; i++) {
    var currentGid = String((sectionList[i] && sectionList[i].gid) || '');
    if (!isValidGid_(currentGid)) continue;
    if (currentGid === String(sectionGid)) {
      if (!firstOtherSectionGid) {
        return;
      }
      break;
    }
    if (!firstOtherSectionGid) {
      firstOtherSectionGid = currentGid;
    }
  }

  if (!isValidGid_(firstOtherSectionGid)) return;

  asanaRequest_('post', '/projects/' + projectGid + '/sections/insert', {
    section: sectionGid,
    before_section: firstOtherSectionGid
  });
}

function getTaskDueFields_(sheetData, taskGroup) {
  var deadlineIso = parseApplicationDeadlineIsoDate_(sheetData);

  if (!deadlineIso) {
    Logger.log('응모 마감일을 찾지 못해 기본 마감일 오프셋을 사용합니다. taskGroup=' + taskGroup);
    return { due_on: getDueDate_(DUE_DAYS_OFFSET) };
  }

  if (taskGroup === 'open') {
    return { due_at: buildSeoulDueAt_(deadlineIso, 13, 0) };
  }

  if (taskGroup === 'update') {
    return { due_on: shiftIsoDate_(deadlineIso, -1) };
  }

  return { due_on: deadlineIso };
}

function buildDueSummaryText_(sheetData) {
  var deadlineIso = parseApplicationDeadlineIsoDate_(sheetData);
  var lines = [];

  if (deadlineIso) {
    lines.push('- 응모 마감일: ' + deadlineIso);
  } else {
    lines.push('- 응모 마감일: 찾지 못함');
    lines.push('- 기본 폴백: 오늘 기준 +' + DUE_DAYS_OFFSET + '일');
  }

  lines.push('- 오픈(상위/하위): ' + formatDueFieldsForDisplay_(getTaskDueFields_(sheetData, 'open')));
  lines.push('- MD(상위/하위): ' + formatDueFieldsForDisplay_(getTaskDueFields_(sheetData, 'md')));
  lines.push('- 업데이트(상위/하위): ' + formatDueFieldsForDisplay_(getTaskDueFields_(sheetData, 'update')));
  lines.push('- VMD(상위/하위): ' + formatDueFieldsForDisplay_(getTaskDueFields_(sheetData, 'vmd')));

  return lines.join('\n');
}

function applyDueFields_(payload, dueFields) {
  if (!payload || !dueFields) return;

  delete payload.due_on;
  delete payload.due_at;

  if (dueFields.due_at) {
    payload.due_at = dueFields.due_at;
    return;
  }

  if (dueFields.due_on) {
    payload.due_on = dueFields.due_on;
  }
}

function formatDueFieldsForDisplay_(dueFields) {
  if (!dueFields) return '(없음)';
  if (dueFields.due_at) {
    return String(dueFields.due_at)
      .replace('T', ' ')
      .replace(':00+09:00', ' KST');
  }
  if (dueFields.due_on) return String(dueFields.due_on);
  return '(없음)';
}

function parseApplicationDeadlineIsoDate_(sheetData) {
  var displayRows = (sheetData && sheetData.displayRows) ? sheetData.displayRows : [];
  var valueRows = (sheetData && sheetData.rows) ? sheetData.rows : [];
  var blockDeadline = findDeadlineFromEventApplicationPeriodBlock_(displayRows, valueRows);

  if (blockDeadline) return blockDeadline;

  var patterns = [
    /(응모.*(?:마감|종료)|(?:마감|종료).*(?:응모|신청))/i,
    /(응모.*기간|응모기간)/i,
    /(마감일|종료일)/i
  ];

  for (var p = 0; p < patterns.length; p++) {
    var deadline = findLastIsoDateInMatchingRows_(displayRows, valueRows, patterns[p]);
    if (deadline) return deadline;
  }

  return null;
}

function findDeadlineFromEventApplicationPeriodBlock_(displayRows, valueRows) {
  for (var rowIndex = 0; rowIndex < displayRows.length; rowIndex++) {
    var displayRow = displayRows[rowIndex] || [];

    for (var colIndex = 0; colIndex < displayRow.length; colIndex++) {
      var cellText = normalizeDeadlineLabelText_(displayRow[colIndex]);
      if (cellText.indexOf('이벤트응모기간') === -1) continue;

      for (var offset = 1; offset <= 4; offset++) {
        var targetRowIndex = rowIndex + offset;
        if (targetRowIndex >= displayRows.length) break;

        var rowDates = extractIsoDatesFromRow_(displayRows[targetRowIndex] || [], valueRows[targetRowIndex] || []);
        if (rowDates.length) return rowDates[rowDates.length - 1];
      }

      var sameRowDates = extractIsoDatesFromRow_(displayRow, valueRows[rowIndex] || []);
      if (sameRowDates.length) return sameRowDates[sameRowDates.length - 1];
    }
  }

  return null;
}

function normalizeDeadlineLabelText_(text) {
  return String(text || '').replace(/\s+/g, '').trim();
}

function findLastIsoDateInMatchingRows_(displayRows, valueRows, pattern) {
  for (var i = 0; i < displayRows.length; i++) {
    var displayRow = displayRows[i] || [];
    var valueRow = valueRows[i] || [];
    var rowText = displayRow.join(' ');
    if (!rowText || !pattern.test(rowText)) continue;

    var rowDates = extractIsoDatesFromRow_(displayRow, valueRow);
    if (rowDates.length) return rowDates[rowDates.length - 1];
  }
  return null;
}

function extractIsoDatesFromRow_(displayRow, valueRow) {
  var matches = [];
  var width = Math.max(displayRow.length, valueRow.length);

  for (var i = 0; i < width; i++) {
    matches = matches.concat(extractIsoDatesFromCell_(valueRow[i], displayRow[i]));
  }

  if (!matches.length) {
    matches = matches.concat(extractIsoDatesFromText_(displayRow.join(' ')));
  }

  return dedupeIsoDates_(matches);
}

function extractIsoDatesFromCell_(rawValue, displayValue) {
  if (Object.prototype.toString.call(rawValue) === '[object Date]' && !isNaN(rawValue.getTime())) {
    return [formatDateToIso_(rawValue)];
  }

  return extractIsoDatesFromText_(displayValue);
}

function extractIsoDatesFromText_(text) {
  var matches = [];
  var normalizedText = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalizedText) return matches;

  var regexes = [
    /(\d{4})[.\-\/년]\s*(\d{1,2})[.\-\/월]\s*(\d{1,2})/g,
    /(\d{2})[.\-\/]\s*(\d{1,2})[.\-\/]\s*(\d{1,2})/g,
    /(\d{1,2})[.\-\/월]\s*(\d{1,2})(?:일)?/g
  ];
  var match;

  for (var r = 0; r < regexes.length; r++) {
    while ((match = regexes[r].exec(normalizedText)) !== null) {
      var year;
      var month;
      var day;

      if (r === 0) {
        year = Number(match[1]);
        month = Number(match[2]);
        day = Number(match[3]);
      } else if (r === 1) {
        year = 2000 + Number(match[1]);
        month = Number(match[2]);
        day = Number(match[3]);
      } else {
        year = new Date().getFullYear();
        month = Number(match[1]);
        day = Number(match[2]);
      }

      if (!isValidDateParts_(year, month, day)) continue;
      matches.push(formatPartsToIso_(year, month, day));
    }
  }

  return dedupeIsoDates_(matches);
}

function isValidDateParts_(year, month, day) {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return false;
  var date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
}

function formatDateToIso_(date) {
  return formatPartsToIso_(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function formatPartsToIso_(year, month, day) {
  return String(year) + '-' +
    String(month).padStart(2, '0') + '-' +
    String(day).padStart(2, '0');
}

function dedupeIsoDates_(dates) {
  var seen = {};
  var result = [];
  for (var i = 0; i < dates.length; i++) {
    var value = String(dates[i] || '');
    if (!value || seen[value]) continue;
    seen[value] = true;
    result.push(value);
  }
  return result;
}

function shiftIsoDate_(isoDate, days) {
  var parts = String(isoDate || '').split('-');
  if (parts.length !== 3) return getDueDate_(days);

  var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  date.setDate(date.getDate() + days);

  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');
}

function buildSeoulDueAt_(isoDate, hour, minute) {
  return String(isoDate) + 'T' +
    String(hour).padStart(2, '0') + ':' +
    String(minute).padStart(2, '0') + ':00+09:00';
}

function getDueDate_(days) {
  var date = new Date();
  date.setDate(date.getDate() + days);
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function isValidGid_(value) {
  return /^\d+$/.test(String(value || ''));
}

function normalizeOptionLabel_(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function getNamedProjectFieldGid_(projectGid, explicitFieldGid, fieldName) {
  try {
    var fieldMap = getProjectCustomFieldMap_(projectGid);
    var matched = fieldMap[normalizeOptionLabel_(fieldName)] || '';
    if (isValidGid_(matched)) return matched;
  } catch (e) {
    Logger.log('프로젝트 필드 이름 탐색 실패: ' + e.message);
  }

  if (isValidGid_(explicitFieldGid)) return String(explicitFieldGid);
  return '';
}

function getCustomFieldEnumOptionMap_(fieldGid) {
  if (!isValidGid_(fieldGid)) return {};

  if (!getCustomFieldEnumOptionMap_.cache) {
    getCustomFieldEnumOptionMap_.cache = {};
  }
  if (getCustomFieldEnumOptionMap_.cache[fieldGid]) {
    return getCustomFieldEnumOptionMap_.cache[fieldGid];
  }

  var field = asanaRequest_('get', '/custom_fields/' + fieldGid, null);
  var options = field.enum_options || [];
  var map = {};

  for (var i = 0; i < options.length; i++) {
    map[normalizeOptionLabel_(options[i].name)] = options[i].gid;
  }

  getCustomFieldEnumOptionMap_.cache[fieldGid] = map;
  return map;
}

function getStatusFieldGid_(projectGid) {
  return getNamedProjectFieldGid_(projectGid, CF_STATUS, CF_STATUS_NAME);
}

function getTaskTypeFieldGid_(projectGid) {
  return getNamedProjectFieldGid_(projectGid, CF_TASK_TYPE, CF_TASK_TYPE_NAME);
}

function getStatusOptionGidByName_(optionName, projectGid) {
  var map = getCustomFieldEnumOptionMap_(getStatusFieldGid_(projectGid));
  return map[normalizeOptionLabel_(optionName)] || '';
}

function getTaskTypeOptionGidByName_(optionName, projectGid) {
  var map = getCustomFieldEnumOptionMap_(getTaskTypeFieldGid_(projectGid));
  return map[normalizeOptionLabel_(optionName)] || '';
}

function getEventFieldGid_(projectGid) {
  var targetProjectGid = isValidGid_(projectGid) ? String(projectGid) : TESTFARM_GID;

  return getNamedProjectFieldGid_(targetProjectGid, CF_EVENT_TYPE, CF_EVENT_TYPE_NAME);
}

function mapEventLabelToAsanaOptionLabel_(label) {
  var normalized = normalizeOptionLabel_(label);
  var optionLabelMap = {
    '특전': '특전 (온라인 럭키드로우 포함)',
    '쇼케이스 초대': '쇼케이스 초대',
    '투샷회': '투샷회',
    '영통 1': '영통 1',
    '영통 2': '영통 2',
    '대면': '대면',
    '포토': '포토',
    '오프라인 이벤트': '오프라인 이벤트',
    '오프라인 럭키드로우': '오프라인 럭키드로우',
    '펀딩': '펀딩',
    '일반 판매': '일반 판매',
    '파생': '파생',
    '기타': '기타'
  };

  return optionLabelMap[normalized] || normalized;
}

function getOpenEventOptionIds_(eventLabels, projectGid) {
  var eventFieldGid = getEventFieldGid_(projectGid);
  if (!isValidGid_(eventFieldGid)) return [];

  try {
    var optionMap = getCustomFieldEnumOptionMap_(eventFieldGid);
    return eventLabels
      .map(function(label) {
        return optionMap[normalizeOptionLabel_(mapEventLabelToAsanaOptionLabel_(label))];
      })
      .filter(isValidGid_);
  } catch (e) {
    Logger.log('getOpenEventOptionIds_ 오류: ' + e.message);
    return [];
  }
}

function getTaskEventFieldInfo_(taskGid) {
  if (!isValidGid_(taskGid)) return null;

  var task = asanaRequest_(
    'get',
    '/tasks/' + taskGid + '?opt_fields=custom_fields.name,custom_fields.gid,custom_fields.enum_options.name,custom_fields.enum_options.gid',
    null
  );

  var fields = task.custom_fields || [];
  for (var i = 0; i < fields.length; i++) {
    var field = fields[i] || {};
    if (normalizeOptionLabel_(field.name) !== normalizeOptionLabel_(CF_EVENT_TYPE_NAME)) continue;

    var optionMap = {};
    var options = field.enum_options || [];
    for (var j = 0; j < options.length; j++) {
      var option = options[j] || {};
      if (!option.name || !isValidGid_(option.gid)) continue;
      optionMap[normalizeOptionLabel_(option.name)] = String(option.gid);
    }

    return {
      fieldGid: isValidGid_(field.gid) ? String(field.gid) : '',
      optionMap: optionMap
    };
  }

  return null;
}

function applyEventFieldCustomFieldIfValid_(customFields, fieldGid, optionGids) {
  if (!isValidGid_(fieldGid)) return;

  var validOptionGids = (optionGids || []).filter(isValidGid_);
  if (validOptionGids.length === 0) return;

  customFields[fieldGid] = validOptionGids.length === 1 ? validOptionGids[0] : validOptionGids;
}

function getProjectLabel_(projectGid) {
  return getProjectName_(projectGid) || String(projectGid || '');
}

function applyRequiredEnumCustomField_(customFields, fieldGid, optionGid, fieldName, optionName, projectGid) {
  if (!isValidGid_(fieldGid)) {
    throw new Error('프로젝트 "' + getProjectLabel_(projectGid) + '"에서 "' + fieldName + '" 필드를 찾지 못했습니다.');
  }
  if (!isValidGid_(optionGid)) {
    throw new Error('프로젝트 "' + getProjectLabel_(projectGid) + '"의 "' + fieldName + '" 필드에서 "' + optionName + '" 옵션을 찾지 못했습니다.');
  }
  customFields[fieldGid] = optionGid;
}

function setEventFieldOnTask_(taskGid, eventLabels, projectGid) {
  if (!isValidGid_(taskGid)) return;

  var fieldInfo = getTaskEventFieldInfo_(taskGid);
  if (!fieldInfo || !isValidGid_(fieldInfo.fieldGid)) {
    Logger.log('태스크에 "' + CF_EVENT_TYPE_NAME + '" 필드가 없어 이벤트 구분 입력을 건너뜁니다: ' + taskGid);
    return;
  }

  var ids = eventLabels
    .map(function(label) {
      return fieldInfo.optionMap[normalizeOptionLabel_(mapEventLabelToAsanaOptionLabel_(label))];
    })
    .filter(isValidGid_);

  if (!ids || ids.length === 0) return;

  try {
    var cf = {};
    cf[fieldInfo.fieldGid] = ids;
    asanaRequest_('put', '/tasks/' + taskGid, { custom_fields: cf });
  } catch (e) {
    try {
      var cf2 = {};
      cf2[fieldInfo.fieldGid] = ids[0];
      asanaRequest_('put', '/tasks/' + taskGid, { custom_fields: cf2 });
    } catch (e2) {
      Logger.log('이벤트 구분 설정 실패: ' + e2.message);
    }
  }
}

function escapeHtml_(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function testAsanaConnection() {
  var ui = SpreadsheetApp.getUi();
  try {
    var me = asanaRequest_('get', '/users/me', null);
    ui.alert('✅ 연결 성공', '인증된 사용자: ' + me.name + '\n(' + me.email + ')', ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('❌ 연결 실패', e.message, ui.ButtonSet.OK);
  }
}

function debugProjectCustomFields_() {
  var project = asanaRequest_(
    'get',
    '/projects/' + TESTFARM_GID + '?opt_fields=custom_field_settings.custom_field.name,custom_field_settings.custom_field.gid',
    null
  );

  var settings = project.custom_field_settings || [];
  for (var i = 0; i < settings.length; i++) {
    var field = settings[i].custom_field || {};
    Logger.log((field.name || '') + ' => ' + (field.gid || ''));
  }
}
