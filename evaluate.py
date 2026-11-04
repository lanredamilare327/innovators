"""Evaluates the XML exchange: XSD validation, parsing correctness, data loss, error detection.
Run: python3 evaluate.py   (needs lxml)"""
from lxml import etree

NS = "urn:example:student-profile:1"
schema = etree.XMLSchema(etree.parse("student-profile.xsd"))

def doc(body="", **o):
    f = dict(id="STU-1", first="Amaka", last="Okafor", dob="2004-03-15", email="a@uni.edu",
             prog="Computer Science", level="300", gpa="4.21")
    f.update(o)
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<StudentProfile xmlns="{NS}" version="1.0"><StudentId>{f["id"]}</StudentId>
<Name><First>{f["first"]}</First><Last>{f["last"]}</Last></Name>
<DateOfBirth>{f["dob"]}</DateOfBirth><Email>{f["email"]}</Email><Program>{f["prog"]}</Program>
<Level>{f["level"]}</Level><GPA>{f["gpa"]}</GPA>{body}</StudentProfile>'''

courses = '<Courses><Course code="CSC301" credits="3"/><Course code="CSC305" credits="4"/></Courses>'

# name, xml, should_be_accepted
cases = [
 ("Valid with courses",            doc(courses), True),
 ("Valid without courses",         doc(), True),
 ("Special chars (& < é)",         doc(prog="R&amp;D &lt;Eng&gt; é"), True),
 ("Not well-formed (unclosed tag)",doc().replace("</Email>", ""), False),
 ("Missing required StudentId",    doc().replace("<StudentId>STU-1</StudentId>", ""), False),
 ("Bad date 15/03/2004",           doc(dob="15/03/2004"), False),
 ("Impossible date 2004-02-31",    doc(dob="2004-02-31"), False),
 ("Bad email",                     doc(email="not-an-email"), False),
 ("GPA out of range (7.5)",        doc(gpa="7.5"), False),
 ("Level not integer (3OO)",       doc(level="3OO"), False),
 ("Wrong namespace",               doc().replace(NS, "urn:other"), False),
 ("Wrong element order",           doc().replace("<StudentId>STU-1</StudentId>","").replace("<Level>", "<StudentId>STU-1</StudentId><Level>"), False),
 ("Unknown extra element",         doc("<Nickname>Ama</Nickname>"), False),
 ("Course credits = 0",            doc('<Courses><Course code="X" credits="0"/></Courses>'), False),
]

# Simulated App B round-trip (its internal model drops Courses and rounds Level to a year)
def app_b_roundtrip(xml):
    r = etree.fromstring(xml.encode()); n = {"s": NS}
    g = lambda p: r.xpath(f"string({p})", namespaces=n).strip()
    lvl = int(g("s:Level"))
    return doc(g("s:StudentId") and "", id=g("s:StudentId"), first=g("s:Name/s:First"), last=g("s:Name/s:Last"),
               dob=g("s:DateOfBirth"), email=g("s:Email"), prog=g("s:Program"), level=str((lvl // 100) * 100), gpa=g("s:GPA"))

def fields(xml):
    r = etree.fromstring(xml.encode())
    return {etree.QName(e).localname + (":" + e.get("code", "") if e.get("code") else ""): (e.text or "").strip()
            for e in r.iter() if e is not r}

print(f"{'Case':36} {'Expected':9} {'Got':9} Result")
passed = 0
for name, x, expect in cases:
    try:
        etree.fromstring(x.encode()); ok = schema.validate(etree.fromstring(x.encode()))
        why = "" if ok else schema.error_log.last_error.message[:60]
    except etree.XMLSyntaxError as e:
        ok, why = False, "not well-formed"
    res = "PASS" if ok == expect else "FAIL"; passed += res == "PASS"
    print(f"{name:36} {'accept' if expect else 'reject':9} {'accept' if ok else 'reject':9} {res}  {why}")
print(f"\nValidation/parsing correctness: {passed}/{len(cases)}")

# Data-loss round trip A -> B -> A
orig = doc(courses); back = app_b_roundtrip(orig)
a, b = fields(orig), fields(back)
lost = [k for k in a if k not in b]
changed = [k for k in a if k in b and a[k] != b[k]]
print(f"Round trip A→B→A: {len(a)} fields sent, {len(a)-len(lost)} survived")
print("  lost:", lost, "| changed:", changed)
print("  fidelity:", f"{(len(a)-len(lost)-len(changed))/len(a):.0%}")
print("  round-tripped doc schema-valid:", schema.validate(etree.fromstring(back.encode())))

# Level precision check
lv = doc(level="350"); lb = fields(app_b_roundtrip(lv))["Level"]
print(f"Level 350 → {lb} (precision loss: {lb != '350'})")
