const NS = "urn:example:student-profile:1";
const $ = id => document.getElementById(id);
let record = null; // {ref, fullName, dob(DD/MM/YYYY), mail, course_of_study, yr, cgpa}

const xmlEsc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

function parse(xml) {
  const r = { errors: [], warnings: [], rec: null };
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) { r.errors.push("Not well-formed XML – rejected"); return r; }
  const resolver = p => p === "s" ? NS : null;
  const x = (ctx, path) => doc.evaluate(path, ctx, resolver, XPathResult.STRING_TYPE, null).stringValue.trim();
  const root = doc.documentElement;
  if (doc.evaluate("/s:StudentProfile", doc, resolver, XPathResult.BOOLEAN_TYPE, null).booleanValue === false) {
    r.errors.push("Root <s:StudentProfile> in namespace " + NS + " not found"); return r;
  }
  const first = x(root,"s:Name/s:First"), last = x(root,"s:Name/s:Last");
  const iso = x(root,"s:DateOfBirth"), level = x(root,"s:Level");
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) r.errors.push("DateOfBirth must be YYYY-MM-DD, got '" + iso + "'");
  if (!x(root,"s:StudentId")) r.errors.push("StudentId missing");
  if (!first || !last) r.errors.push("Name/First and Name/Last required");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x(root,"s:Email"))) r.errors.push("Email invalid");
  if (!x(root,"s:Program")) r.errors.push("Program missing");
  if (!/^\d+$/.test(level) || +level < 100 || +level > 600) r.errors.push("Level must be an integer 100–600");
  const gpa = x(root,"s:GPA");
  if (gpa === "" || isNaN(+gpa) || +gpa < 0 || +gpa > 5) r.errors.push("GPA must be a number 0–5");

  // Data-loss detection: this app has no place for these
  const nCourses = doc.evaluate("count(//s:Course)", doc, resolver, XPathResult.NUMBER_TYPE, null).numberValue;
  if (nCourses) r.warnings.push(`${nCourses} <Course> element(s) cannot be stored – data loss`);
  const known = ["StudentProfile","StudentId","Name","First","Last","DateOfBirth","Email","Program","Level","GPA","Courses","Course"];
  const unknown = new Set([...doc.getElementsByTagName("*")].map(e => e.localName).filter(n => !known.includes(n)));
  unknown.forEach(n => r.warnings.push(`Unknown element <${n}> dropped – data loss`));
  if (+level % 100 !== 0) r.warnings.push(`Level ${level} rounded to year ${Math.floor(+level/100)} – precision lost`);

  if (!r.errors.length) r.rec = {
    ref: x(root,"s:StudentId"), fullName: last + ", " + first,
    dob: `${m[3]}/${m[2]}/${m[1]}`, mail: x(root,"s:Email"), course_of_study: x(root,"s:Program"),
    yr: Math.floor(+level/100), cgpa: +gpa };
  return r;
}

function build(rec) {
  const [last, first] = rec.fullName.split(",").map(s => s.trim());
  const [dd, mm, yyyy] = rec.dob.split("/");
  return `<?xml version="1.0" encoding="UTF-8"?>
<StudentProfile xmlns="${NS}" version="1.0">
<StudentId>${xmlEsc(rec.ref)}</StudentId>
<Name>
<First>${xmlEsc(first)}</First>
<Last>${xmlEsc(last)}</Last>
</Name>
<DateOfBirth>${yyyy}-${mm}-${dd}</DateOfBirth>
<Email>${xmlEsc(rec.mail)}</Email>
<Program>${xmlEsc(rec.course_of_study)}</Program>
<Level>${rec.yr * 100}</Level>
<GPA>${rec.cgpa}</GPA>
</StudentProfile>`;
}

function render() {
  $("rec").innerHTML = record ? "<table>" + Object.entries(record).map(([k,v]) => `<tr><th>${k}</th><td>${xmlEsc(v)}</td></tr>`).join("") + "</table>" : "";
}
function show(r, ok) {
  $("out").innerHTML = r.errors.map(x=>`<div class="err">✗ ${xmlEsc(x)}</div>`).join("") +
    r.warnings.map(x=>`<div class="warn">⚠ ${xmlEsc(x)}</div>`).join("") +
    (!r.errors.length ? `<div class="ok">✓ ${ok}</div>` : "");
}
function importXml() { const r = parse($("xml").value); if (r.rec) record = r.rec; render(); show(r, "Imported into App B's model."); }
function exportXml() {
  if (!record) return show({errors:["Nothing to export – import a record first"],warnings:[]});
  $("xml").value = build(record); show({errors:[],warnings:["Courses are not included (App B does not store them)"]}, "XML exported. Import it back into App A.");
}