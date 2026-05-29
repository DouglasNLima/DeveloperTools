import { buildCronRruleSchedule, SCHEDULE_FREQUENCIES, WEEKDAYS } from './cron-rrule-builder.js';
import { bindSyntaxHighlight } from './syntax-highlight.js';

export function renderCronRruleBuilder(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="scheduleFrequency">Schedule type</label>
          <select id="scheduleFrequency">
            ${SCHEDULE_FREQUENCIES.map(frequency => `<option value="${frequency.value}">${frequency.label}</option>`).join('')}
          </select>
        </div>

        <div class="field-stack">
          <label for="scheduleInterval">Interval</label>
          <input id="scheduleInterval" type="number" min="1" max="99" step="1" value="1" />
        </div>

        <div class="button-row button-row--end">
          <button id="buildScheduleButton" class="primary" type="button">Build schedule</button>
          <button id="clearScheduleButton" class="secondary" type="button">Clear</button>
        </div>
      </div>

      <div class="form-grid form-grid--split">
        <div class="field-stack">
          <label for="scheduleHour">Hour</label>
          <input id="scheduleHour" type="number" min="0" max="23" step="1" value="9" />
        </div>

        <div class="field-stack">
          <label for="scheduleMinute">Minute</label>
          <input id="scheduleMinute" type="number" min="0" max="59" step="1" value="0" />
        </div>
      </div>

      <div class="form-grid form-grid--split">
        <div class="field-stack">
          <label for="scheduleMonthDay">Month day</label>
          <input id="scheduleMonthDay" type="number" min="1" max="31" step="1" value="1" />
        </div>

        <div class="field-stack">
          <label for="scheduleTimezone">Timezone</label>
          <input id="scheduleTimezone" type="text" placeholder="Europe/Dublin" />
        </div>
      </div>

      <div class="field-stack">
        <label for="scheduleStartDate">Start date</label>
        <input id="scheduleStartDate" type="date" />
      </div>

      <div class="field-stack">
        <label>Weekdays</label>
        <div class="option-grid" id="scheduleWeekdays">
          ${WEEKDAYS.map(day => `
            <label class="checkbox-row" for="scheduleWeekday${day.value}">
              <input id="scheduleWeekday${day.value}" type="checkbox" value="${day.value}" ${day.value === 'MO' ? 'checked' : ''} />
              <span>${day.label}</span>
            </label>
          `).join('')}
        </div>
      </div>

      <div class="output-toolbar">
        <label for="scheduleOutput">Schedule output</label>
        <div class="button-row">
          <button id="copyScheduleButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadScheduleButton" class="button secondary" href="#" download="cron-rrule-schedule.md" hidden>Download output</a>
        </div>
      </div>

      <textarea id="scheduleOutput" spellcheck="false" readonly placeholder="The cron, RRULE and handover snippet will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Schedule type</span>
          <strong id="scheduleFrequencyDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Cron</span>
          <strong id="scheduleCronDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="scheduleWarningsDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output size</span>
          <strong id="scheduleSizeDetail">-</strong>
        </div>
      </div>

      <div id="scheduleStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const frequency = container.querySelector('#scheduleFrequency');
  const interval = container.querySelector('#scheduleInterval');
  const hour = container.querySelector('#scheduleHour');
  const minute = container.querySelector('#scheduleMinute');
  const monthDay = container.querySelector('#scheduleMonthDay');
  const timezone = container.querySelector('#scheduleTimezone');
  const startDate = container.querySelector('#scheduleStartDate');
  const weekdayInputs = [...container.querySelectorAll('#scheduleWeekdays input')];
  const buildButton = container.querySelector('#buildScheduleButton');
  const clearButton = container.querySelector('#clearScheduleButton');
  const copyButton = container.querySelector('#copyScheduleButton');
  const downloadButton = container.querySelector('#downloadScheduleButton');
  const output = container.querySelector('#scheduleOutput');
  const frequencyDetail = container.querySelector('#scheduleFrequencyDetail');
  const cronDetail = container.querySelector('#scheduleCronDetail');
  const warningsDetail = container.querySelector('#scheduleWarningsDetail');
  const sizeDetail = container.querySelector('#scheduleSizeDetail');
  const status = container.querySelector('#scheduleStatus');
  const outputHighlight = bindSyntaxHighlight(output, { language: 'markdown' });

  let currentObjectUrl = null;

  startDate.value = new Date().toISOString().slice(0, 10);
  timezone.value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  function revokeObjectUrl() {
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }

    downloadButton.hidden = true;
    downloadButton.removeAttribute('href');
  }

  function setStatus(message, type) {
    status.textContent = message;
    status.className = `status-message${type ? ` ${type}` : ''}`;
  }

  function resetDetails() {
    frequencyDetail.textContent = '-';
    cronDetail.textContent = '-';
    warningsDetail.textContent = '-';
    sizeDetail.textContent = '-';
  }

  function setOutput(result) {
    outputHighlight.setLanguage('markdown');
    output.value = result.output;
    copyButton.disabled = false;
    frequencyDetail.textContent = result.frequencyLabel;
    cronDetail.textContent = result.cron;
    warningsDetail.textContent = result.warnings.length === 0 ? 'None' : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
    sizeDetail.textContent = result.outputSizeLabel;
    revokeObjectUrl();

    const blob = new Blob([result.output], { type: 'text/markdown;charset=utf-8' });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = 'cron-rrule-schedule.md';
    downloadButton.textContent = 'Download cron-rrule-schedule.md';
    downloadButton.hidden = false;
  }

  function getSelectedWeekdays() {
    return weekdayInputs
      .filter(input => input.checked)
      .map(input => input.value);
  }

  function handleBuild() {
    try {
      const result = buildCronRruleSchedule({
        frequency: frequency.value,
        interval: interval.value,
        hour: hour.value,
        minute: minute.value,
        monthDay: monthDay.value,
        timezone: timezone.value,
        startDate: startDate.value,
        weekdays: getSelectedWeekdays()
      });

      setOutput(result);
      setStatus('Cron and RRULE schedule built successfully.', 'success');
    } catch (error) {
      outputHighlight.setLanguage('plain');
      output.value = '';
      copyButton.disabled = true;
      revokeObjectUrl();
      resetDetails();
      setStatus(error.message || 'Unable to build this schedule.', 'error');
    }
  }

  async function copyOutput() {
    if (!output.value || copyButton.disabled) {
      setStatus('There is no schedule output to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      setStatus('Schedule output copied to the clipboard.', 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus('Schedule output selected and copied using the browser fallback.', 'success');
    }
  }

  buildButton.addEventListener('click', handleBuild);
  copyButton.addEventListener('click', copyOutput);

  clearButton.addEventListener('click', () => {
    frequency.value = 'daily';
    interval.value = '1';
    hour.value = '9';
    minute.value = '0';
    monthDay.value = '1';
    timezone.value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    startDate.value = new Date().toISOString().slice(0, 10);
    weekdayInputs.forEach(input => {
      input.checked = input.value === 'MO';
    });
    output.value = '';
    outputHighlight.setLanguage('markdown');
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    setStatus('Ready.', null);
    frequency.focus();
  });

  return () => {
    outputHighlight.destroy();
    revokeObjectUrl();
  };
}
