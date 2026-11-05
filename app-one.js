const NS = "urn:example:student-profile:1";
const KNOWN = new Set(["StudentProfile","StudentId","Name","First","Last","DateOfBirth","Email","Program","Level","GPA","Courses","Course"]);
const $ = id => document.getElementById(id);

function readForm() {
  const courses = $("courses").value.split("\n").map(l => l.trim()).filter(Boolean)
    .map(l => { const [code, credits] = l.split(","); return { code: (code||"").trim(), credits: (credits||"").trim() }; });
  return { id:$("id").value.trim(), first:$("first").value.trim(), last:$("last").value.trim(),
    dob:$("dob").value, email:$("email").value.trim(), program:$("program").value.trim(),
    level:$("level").value.trim(), gpa:$("gpa").value.trim(), courses };
}
function writeForm(s) {
  $("id").value=s.id; $("first").value=s.first; $("last").value=s.last; $("dob").value=s.dob;
  $("email").value=s.email; $("program").value=s.program; $("level").value=s.level; $("gpa").value=s.gpa;
  $("courses").value = s.courses.map(c => c.code+","+c.credits).join("\n");
}

function validate(s) {
  const e = [];
  if (!s.id) e.push("StudentId is required");
  if (!s.first) e.push("Name/First is required");
  if (!s.last) e.push("Name/Last is required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.dob) || isNaN(Date.parse(s.dob))) e.push("DateOfBirth must be a valid YYYY-MM-DD date");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email)) e.push("Email is not valid");
  if (!s.program) e.push("Program is required");
  if (!/^\d+$/.test(s.level) || +s.level < 100 || +s.level > 600) e.push("Level must be an integer 100–600");
  if (s.gpa === "" || isNaN(+s.gpa) || +s.gpa < 0 || +s.gpa > 5) e.push("GPA must be a number 0–5");
  s.courses.forEach((c,i) => {
    if (!c.code) e.push(`Course ${i+1}: code missing`);
    if (!/^[1-9]\d*$/.test(c.credits)) e.push(`Course ${i+1}: credits must be a positive integer`);
  });
  return e;
}

function build(s) {
  // Built with the DOM so escaping of & < > " is automatic.
  const d = document.implementation.createDocument(NS, "StudentProfile");
  const root = d.documentElement; root.setAttribute("version", "1.0");
  const add = (p, n, t) => { const e = d.createElementNS(NS, n); if (t !== undefined) e.textContent = t; p.appendChild(e); return e; };
  add(root,"StudentId",s.id);
  const nm = add(root,"Name"); add(nm,"First",s.first); add(nm,"Last",s.last);
  add(root,"DateOfBirth",s.dob); add(root,"Email",s.email); add(root,"Program",s.program);
  add(root,"Level",s.level); add(root,"GPA",s.gpa);
  const cs = add(root,"Courses");
  s.courses.forEach(c => { const ce = add(cs,"Course"); ce.setAttribute("code",c.code); ce.setAttribute("credits",c.credits); });
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(d).replace(/></g, ">\n<");
}

function parse(xml) {
  const report = { errors: [], warnings: [], data: null };
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const pe = doc.getElementsByTagName("parsererror")[0];
  if (pe) { report.errors.push("Not well-formed XML: " + pe.textContent.split("\n")[0]); return report; }
  const root = doc.documentElement;
  if (root.localName !== "StudentProfile") { report.errors.push("Unexpected root element <" + root.localName + ">"); return report; }
  if (root.namespaceURI !== NS) { report.errors.push("Wrong namespace: " + root.namespaceURI); return report; }
  const t = (p, n) => { const el = p.getElementsByTagNameNS(NS, n)[0]; return el ? el.textContent.trim() : ""; };
  const nameEl = root.getElementsByTagNameNS(NS, "Name")[0];
  const s = { id:t(root,"StudentId"), first:nameEl?t(nameEl,"First"):"", last:nameEl?t(nameEl,"Last"):"",
    dob:t(root,"DateOfBirth"), email:t(root,"Email"), program:t(root,"Program"),
    level:t(root,"Level"), gpa:t(root,"GPA"),
    courses:[...root.getElementsByTagNameNS(NS,"Course")].map(c => ({code:c.getAttribute("code")||"", credits:c.getAttribute("credits")||""})) };
  // Data-loss detection: elements this app does not understand
  const all = [root, ...root.getElementsByTagName("*")];
  const unknown = [...new Set(all.filter(e => !KNOWN.has(e.localName)).map(e => e.localName))];
  unknown.forEach(n => report.warnings.push(`Unknown element <${n}> ignored (data loss)`));
  report.errors.push(...validate(s));
  report.data = s;
  return report;
}

function show(r, okMsg) {
  $("out").innerHTML =
    r.errors.map(x => `<div class="err">✗ ${x}</div>`).join("") +
    r.warnings.map(x => `<div class="warn">⚠ ${x}</div>`).join("") +
    (!r.errors.length ? `<div class="ok">✓ ${okMsg}</div>` : "");
}
function exportXml() {
  const s = readForm(), errs = validate(s);
  if (errs.length) return show({errors:errs,warnings:[]}, "");
  $("xml").value = build(s); show({errors:[],warnings:[]}, "Valid – XML generated. Copy it into App B.");
}
function importXml() {
  const r = parse($("xml").value);
  if (r.data) writeForm(r.data);
  show(r, "Imported and valid.");
}