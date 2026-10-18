"""Shared by the Lift browser suites so the same tests run on both looks: the classic one (lift/, lift2/) and
"The Edge" redesign (test camp first, 4.13+).
- The Edge writes some labels in capitals with CSS (text-transform). Playwright's inner_text returns the capitalised
  form, so the functional suites switch text-transform off (NO_CAPS). How it looks is checked by lift_edge_e2e.py.
- The Edge renames the visible tab labels (route ids stay today/programs/log/user), so expected labels depend on the look."""
NO_CAPS = ("document.addEventListener('DOMContentLoaded',function(){var s=document.createElement('style');"
           "s.textContent='*{text-transform:none!important}';document.head.appendChild(s);});")
EDGE_TITLES = {"LIFT/": "Lift", "Train": "Programs", "Progress": "Log", "You": "User", "التدريب": "البرامج", "التقدّم": "السجل"}

def is_edge(pg):
    return bool(pg.evaluate("typeof DESIGN!=='undefined'&&DESIGN==='edge'"))

def root_title(pg):
    """'ROOT:<tab>' using the classic names, whichever look is running."""
    t = pg.evaluate("(()=>{var h=document.querySelector('.root-top h1');return h?h.textContent.trim():''})()")
    return "ROOT:" + EDGE_TITLES.get(t, t)

def tabs_en(pg):
    return ["Home", "Train", "Progress", "You"] if is_edge(pg) else ["Home", "Programs", "Log", "User"]

def tabs_ar(pg):
    return ["الرئيسية", "التدريب", "التقدّم", "حسابي"] if is_edge(pg) else ["الرئيسية", "البرامج", "السجل", "حسابي"]
