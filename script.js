const API_KEY = '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';

['mcq','fill','short'].forEach(type => {
  const chip = document.getElementById('chip-' + type);
  const cb = document.getElementById('type-' + type);
  chip.addEventListener('click', () => {
    cb.checked = !cb.checked;
    chip.classList.toggle('active-' + type, cb.checked);
  });
});

async function generateQuiz() {
  const text = document.getElementById('inputText').value.trim();
  const numQ = document.getElementById('numQuestions').value;
  const diff = document.getElementById('difficulty').value;
  const subj = document.getElementById('subject').value;
  const useMCQ = document.getElementById('type-mcq').checked;
  const useFill = document.getElementById('type-fill').checked;
  const useShort = document.getElementById('type-short').checked;

  if (!text) { showError('Please paste some textbook content first!'); return; }
  if (!useMCQ && !useFill && !useShort) { showError('Please select at least one question type!'); return; }

  const btn = document.getElementById('generateBtn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div><span>Generating quiz...</span>';
  document.getElementById('results').innerHTML = '';

  const types = [];
  if (useMCQ) types.push('MCQ (multiple_choice): 4 options A B C D, mark correct answer');
  if (useFill) types.push('FILL (fill_blank): sentence with _____ for missing word, provide answer');
  if (useShort) types.push('SHORT (short_answer): open-ended question with a concise answer');

  const prompt = `You are an expert quiz generator for ${subj} education. Generate exactly ${numQ} questions at ${diff} difficulty from the following text.

Question types to include: ${types.join('; ')}.

Distribute questions as evenly as possible among the selected types.

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "questions": [
    {
      "type": "multiple_choice",
      "question": "What is ...?",
      "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
      "answer": "A",
      "explanation": "Brief reason why this is correct."
    },
    {
      "type": "fill_blank",
      "question": "The _____ is responsible for ...",
      "answer": "word or phrase",
      "explanation": "Brief explanation."
    },
    {
      "type": "short_answer",
      "question": "Explain why ...?",
      "answer": "Concise model answer.",
      "explanation": "Key points."
    }
  ]
}

SOURCE TEXT:
${text.slice(0, 4000)}`;

  try {
    const res = await fetch(
      `https://api.groq.com/openai/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 4096
        })
      }
    );

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'API error');

    const raw = data.choices?.[0]?.message?.content || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse response. Try again.');

    const parsed = JSON.parse(jsonMatch[0]);
    renderResults(parsed.questions, numQ, diff);

  } catch (err) {
    showError('Error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>⚡ Generate Quiz</span>';
  }
}

function renderResults(questions, numQ, diff) {
  if (!questions || questions.length === 0) {
    showError('No questions were generated. Try with more detailed text.');
    return;
  }

  const mcqCount = questions.filter(q => q.type === 'multiple_choice').length;
  const fillCount = questions.filter(q => q.type === 'fill_blank').length;
  const shortCount = questions.filter(q => q.type === 'short_answer').length;

  let html = `
    <div style="margin-bottom:14px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
      <div class="results-title">Generated Quiz</div>
      <button class="btn-export" onclick="exportQuiz()">📋 Export as Text</button>
    </div>
    <div class="stats-row">
      <span class="stat-pill pill-mcq">MCQ × ${mcqCount}</span>
      <span class="stat-pill pill-fill">Fill × ${fillCount}</span>
      <span class="stat-pill pill-short">Short × ${shortCount}</span>
      <span class="stat-pill" style="background:rgba(255,255,255,0.05);color:var(--muted);border:1px solid var(--border);">${diff.toUpperCase()}</span>
    </div>
  `;

  questions.forEach((q, i) => {
    const typeLabel = q.type === 'multiple_choice' ? 'MCQ' : q.type === 'fill_blank' ? 'FILL' : 'SHORT';
    const badgeClass = q.type === 'multiple_choice' ? 'badge-mcq' : q.type === 'fill_blank' ? 'badge-fill' : 'badge-short';

    html += `<div class="q-card" id="qcard-${i}">
      <span class="q-type-badge ${badgeClass}">${typeLabel}</span>
      <div class="q-number">Q${i + 1}</div>
      <div class="q-text">${q.question}</div>`;

    if (q.type === 'multiple_choice' && q.options) {
      html += `<div class="options-grid">`;
      ['A','B','C','D'].forEach(letter => {
        if (q.options[letter]) {
          html += `<div class="option" id="opt-${i}-${letter}" onclick="checkAnswer(${i},'${letter}','${q.answer}')">
            <span class="option-letter">${letter}</span>
            <span>${q.options[letter]}</span>
          </div>`;
        }
      });
      html += `</div>`;
    }

    html += `
      <div class="answer-box" id="ans-${i}">
        <strong>✅ Answer:</strong> ${q.answer}
        ${q.explanation ? `<br><span style="color:var(--muted);margin-top:4px;display:block;">${q.explanation}</span>` : ''}
      </div>`;

    if (q.type !== 'multiple_choice') {
      html += `<button class="reveal-btn" onclick="toggleAnswer(${i})">Show Answer</button>`;
    }

    html += `</div>`;
  });

  document.getElementById('results').innerHTML = html;
  window._quizQuestions = questions;
}

function checkAnswer(qIndex, selected, correct) {
  ['A','B','C','D'].forEach(letter => {
    const el = document.getElementById(`opt-${qIndex}-${letter}`);
    if (el) { el.classList.remove('correct','wrong'); el.style.pointerEvents = 'none'; }
  });
  const selectedEl = document.getElementById(`opt-${qIndex}-${selected}`);
  const correctEl = document.getElementById(`opt-${qIndex}-${correct}`);
  if (selected === correct) {
    selectedEl?.classList.add('correct');
  } else {
    selectedEl?.classList.add('wrong');
    correctEl?.classList.add('correct');
  }
  const ansBox = document.getElementById(`ans-${qIndex}`);
  if (ansBox) ansBox.classList.add('visible');
}

function toggleAnswer(qIndex) {
  const box = document.getElementById(`ans-${qIndex}`);
  box?.classList.toggle('visible');
}

function exportQuiz() {
  const questions = window._quizQuestions;
  if (!questions) return;
  let out = 'QUIZ EXPORT\n' + '='.repeat(50) + '\n\n';
  questions.forEach((q, i) => {
    const typeLabel = q.type === 'multiple_choice' ? '[MCQ]' : q.type === 'fill_blank' ? '[Fill in the Blank]' : '[Short Answer]';
    out += `${typeLabel} Q${i+1}: ${q.question}\n`;
    if (q.type === 'multiple_choice' && q.options) {
      ['A','B','C','D'].forEach(l => q.options[l] && (out += `  ${l}) ${q.options[l]}\n`));
    }
    out += `Answer: ${q.answer}\n\n`;
  });
  const blob = new Blob([out], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'quiz_export.txt';
  a.click();
}

function showError(msg) {
  document.getElementById('results').innerHTML = `<div class="error-box">⚠️ ${msg}</div>`;
}
