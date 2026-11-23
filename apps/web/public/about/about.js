const stages = [
  [
    "Import",
    "PDF, Markdown or TXT",
    "Page text",
    "Extract text or use local OCR. Retain document identity and one-based page numbers.",
  ],
  [
    "Chunk",
    "Page text",
    "Overlapping passages and source offsets",
    "Split recursively. The default is 900 characters with 150 overlap. Smaller windows can focus retrieval at the cost of more chunks.",
  ],
  [
    "Index",
    "Passages and metadata",
    "Chroma vectors and SQLite source rows",
    "Embed passages on import. Store canonical text separately. Changing the embedding model requires rebuilding the index.",
  ],
  [
    "Frame query",
    "Question and selected sources",
    "Query text and document filter",
    "A follow-up heuristic can append earlier questions. The scope comes from the student.",
  ],
  [
    "Retrieve",
    "Query embedding",
    "Ranked ready-document chunks",
    "Chroma searches by similarity. SQLite checks source state. Five chunks are returned by default.",
  ],
  [
    "Generate",
    "Question, history and evidence",
    "Structured answer and citations",
    "A Gemini or OpenAI adapter passes retrieved text to a language model with instructions to ignore commands in the sources and abstain if unsupported.",
  ],
  [
    "Verify and cite",
    "Proposed answer and references",
    "Exact quote and linked concept IDs",
    "Validate IDs, pages and quote substrings against retrieved sources. Retry invalid structured output once. This checks provenance; claim support needs separate review.",
  ],
];
const byId = (id) => document.getElementById(id);
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function switches(group, labels, offset, onSelect) {
  labels.forEach((label, index) => {
    if (index && group.id.endsWith("steps")) {
      const arrow = el("span", "→", "arrow");
      arrow.setAttribute("aria-hidden", "true");
      group.append(arrow);
    }
    const button = el("button", label);
    button.type = "button";
    button.dataset.value = index + offset;
    button.addEventListener("click", () => onSelect(index + offset));
    group.append(button);
  });
}
function pressed(group, selected) {
  group.querySelectorAll("button").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(Number(button.dataset.value) === selected),
    );
  });
}
function showStage(index) {
  const [title, input, output, rationale] = stages[index];
  pressed(byId("index-steps"), index);
  pressed(byId("query-steps"), index);
  const details = el("dl");
  details.append(
    el("dt", "Input"),
    el("dd", input),
    el("dt", "Output"),
    el("dd", output),
  );
  byId("stage").replaceChildren(el("h3", title), el("p", rationale), details);
}
switches(
  byId("index-steps"),
  stages.slice(0, 3).map((row) => row[0]),
  0,
  showStage,
);
switches(
  byId("query-steps"),
  stages.slice(3).map((row) => row[0]),
  3,
  showStage,
);
showStage(4);

const demo = [
  [
    "Choose notes",
    "Start with a lecture and review sheet",
    "Both files cover retrieval practice. Each passage retains its own source identity.",
  ],
  [
    "Ask",
    "What is retrieval practice?",
    "The retriever ranks passages from the selected study material. It can scope search to a specific note.",
  ],
  [
    "Read answer",
    "Recall an idea before looking",
    "Close the notes and explain the idea from memory. Reopen the notes and compare your answer with the source.",
  ],
  [
    "Inspect citation",
    "Memory and learning · page 1",
    "Compare the explanation with this exact passage.",
    "Retrieval practice means trying to recall an idea before looking at the answer.",
  ],
  [
    "Try unsupported",
    "What is the exam date?",
    "The sample notes do not contain an exam date. Add the course announcement if you want to check it.",
  ],
];
function showDemo(index) {
  const [, title, body, quote] = demo[index];
  pressed(byId("demo-controls"), index);
  const view = byId("demo-view");
  view.replaceChildren(el("h3", title), el("p", body));
  if (quote) view.append(el("blockquote", quote));
  if (index === 2) {
    const link = el("a", "Check the exact passage →");
    link.href = "#demo-view";
    link.addEventListener("click", (event) => {
      event.preventDefault();
      showDemo(3);
      byId("demo-controls").querySelector('[data-value="3"]').focus();
    });
    view.append(link);
  }
}
switches(
  byId("demo-controls"),
  demo.map((row) => row[0]),
  0,
  showDemo,
);
showDemo(0);

async function loadReport() {
  const reports = {};
  await Promise.all(
    ["live", "mock"].map(async (mode) => {
      const response = await fetch("./results-" + mode + ".json");
      if (!response.ok) throw new Error("Could not load benchmark");
      reports[mode] = await response.json();
    }),
  );
  const root = byId("report");
  function field(id, name) {
    const label = el("label", name);
    label.htmlFor = id;
    const select = el("select");
    select.id = id;
    return [label, select];
  }
  const [modeLabel, mode] = field("benchmark-mode", "Embedding mode");
  const [runLabel, config] = field("benchmark-run", "Configuration");
  const [caseLabel, question] = field("benchmark-case", "Question");
  mode.append(
    new Option("Live Gemini embeddings", "live"),
    new Option("Deterministic fixture", "mock"),
  );
  const summary = el("p", undefined, "muted");
  const comparison = el("div", undefined, "table-wrap");
  comparison.tabIndex = 0;
  comparison.setAttribute("aria-label", "Retrieval comparison");
  const detail = el("div", undefined, "case");
  root.replaceChildren(
    modeLabel,
    mode,
    summary,
    comparison,
    runLabel,
    config,
    caseLabel,
    question,
    detail,
  );

  const runName = (run) =>
    run.chunkSize +
    "/" +
    run.overlap +
    (run.ranking === "vector"
      ? " · App retriever order"
      : " · Term-overlap rerank");
  function showCase() {
    const run = reports[mode.value].runs[Number(config.value)];
    const item = run.cases[Number(question.value)];
    const match = item.rank
      ? "First match at rank " + item.rank
      : "No gold match in top three";
    detail.replaceChildren(
      el("h3", item.question),
      el("p", item.document + " · " + match),
      el("blockquote", item.quote),
      el(
        "p",
        "Scope: " +
          (item.scope?.join(", ") || "All four notes") +
          " · " +
          item.retrievalMs +
          " ms",
        "muted",
      ),
    );
    const list = el("ol");
    item.retrievedChunkIds.forEach((id) => list.append(el("li", id)));
    detail.append(el("h4", "Returned chunk IDs"), list);
    comparison.querySelectorAll("tbody tr").forEach((row, index) => {
      row.toggleAttribute("data-selected", index === Number(config.value));
    });
  }
  function showMode() {
    const data = reports[mode.value];
    summary.textContent =
      data.questions +
      " labelled questions · " +
      Object.keys(data.corpus).length +
      " public notes · " +
      data.runs[0].embedding +
      ". Timings cover retrieval, including the live embedding call. This authored dataset is exploratory.";
    config.replaceChildren(
      ...data.runs.map((run, index) => new Option(runName(run), index)),
    );
    question.replaceChildren(
      ...data.runs[0].cases.map(
        (item, index) => new Option(item.question, index),
      ),
    );
    const firstMiss = data.runs[0].cases.findIndex(
      (item) => item.rank === null,
    );
    question.selectedIndex = Math.max(0, firstMiss);
    const table = el("table"),
      head = el("thead"),
      header = el("tr"),
      body = el("tbody");
    for (const name of [
      "Configuration",
      "Chunks",
      "Hit@1",
      "Hit@3",
      "MRR@3",
      "p95 ms",
      "Context chars",
      "Scope leaks",
    ]) {
      const cell = el("th", name);
      cell.scope = "col";
      header.append(cell);
    }
    head.append(header);
    for (const run of data.runs) {
      const row = el("tr");
      const values = [
        runName(run),
        run.chunks,
        run.hitAt1.toFixed(2),
        run.hitAt3.toFixed(2),
        run.mrrAt3.toFixed(3),
        run.p95Ms.toFixed(1),
        run.meanContextChars,
        run.outOfScope + " / " + run.scopedCases + " checks",
      ];
      row.append(...values.map((value) => el("td", value)));
      body.append(row);
    }
    table.append(head, body);
    comparison.replaceChildren(table);
    showCase();
  }
  mode.addEventListener("change", showMode);
  config.addEventListener("change", showCase);
  question.addEventListener("change", showCase);
  showMode();
}
loadReport().catch(() => {
  byId("report").textContent =
    "Recorded results could not be loaded. Open the hosted case study or serve the page over HTTP.";
});
