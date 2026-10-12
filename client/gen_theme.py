"""Generates client/src/theme-indigo.css: remaps the light-mode utility classes used across
the pages onto a dark indigo glass palette, scoped to `.app-theme`."""
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src", "theme-indigo.css")
S = '.app-theme'
rules = []


def tok(token, decl, hover=False, extra=''):
    esc = token
    sel = f'{S} [class~="{esc}"]'
    rules.append(f'{sel}{extra} {{ {decl} }}')
    # opacity variants such as bg-white/80
    rules.append(f'{S} [class^="{esc}/"]{extra}, {S} [class*=" {esc}/"]{extra} {{ {decl} }}')


def with_hover(token, decl):
    tok(token, decl)
    h = f'hover:{token}'
    rules.append(f'{S} [class~="{h}"]:hover {{ {decl} }}')
    f = f'focus:{token}'
    rules.append(f'{S} [class~="{f}"]:focus {{ {decl} }}')
    g = f'group-hover:{token}'
    rules.append(f'{S} .group:hover [class~="{g}"] {{ {decl} }}')


GLASS = 'background-color: rgba(20, 18, 62, 0.9)'
BG = {
    'bg-white': GLASS,
    'bg-slate-50': 'background-color: rgba(255,255,255,0.05)',
    'bg-gray-50': 'background-color: rgba(255,255,255,0.05)',
    'bg-slate-100': 'background-color: rgba(255,255,255,0.08)',
    'bg-slate-200': 'background-color: rgba(255,255,255,0.12)',
    'bg-slate-300': 'background-color: rgba(255,255,255,0.18)',
    'bg-indigo-50': 'background-color: rgba(99,102,241,0.16)',
    'bg-indigo-100': 'background-color: rgba(99,102,241,0.26)',
    'bg-violet-50': 'background-color: rgba(139,92,246,0.16)',
    'bg-violet-100': 'background-color: rgba(139,92,246,0.26)',
    'bg-purple-50': 'background-color: rgba(168,85,247,0.16)',
    'bg-purple-100': 'background-color: rgba(168,85,247,0.26)',
    'bg-emerald-50': 'background-color: rgba(16,185,129,0.16)',
    'bg-emerald-100': 'background-color: rgba(16,185,129,0.26)',
    'bg-green-50': 'background-color: rgba(34,197,94,0.16)',
    'bg-green-100': 'background-color: rgba(34,197,94,0.26)',
    'bg-rose-50': 'background-color: rgba(244,63,94,0.15)',
    'bg-rose-100': 'background-color: rgba(244,63,94,0.25)',
    'bg-red-50': 'background-color: rgba(239,68,68,0.15)',
    'bg-red-100': 'background-color: rgba(239,68,68,0.25)',
    'bg-amber-50': 'background-color: rgba(245,158,11,0.15)',
    'bg-amber-100': 'background-color: rgba(245,158,11,0.25)',
    'bg-orange-50': 'background-color: rgba(249,115,22,0.15)',
    'bg-orange-100': 'background-color: rgba(249,115,22,0.25)',
    'bg-sky-50': 'background-color: rgba(14,165,233,0.15)',
    'bg-sky-100': 'background-color: rgba(14,165,233,0.25)',
    'bg-blue-50': 'background-color: rgba(59,130,246,0.15)',
    'bg-blue-100': 'background-color: rgba(59,130,246,0.25)',
}
for t, d in BG.items():
    with_hover(t, d)

TEXT = {
    'text-slate-950': '#ffffff', 'text-slate-900': '#ffffff', 'text-slate-800': '#ffffff',
    'text-slate-700': '#f5f6ff', 'text-slate-600': '#eceeff', 'text-slate-500': '#d9ddff',
    'text-slate-400': '#c3c9f7', 'text-gray-900': '#ffffff', 'text-gray-700': '#f5f6ff',
    'text-gray-500': '#d9ddff', 'text-black': '#ffffff',
    'text-indigo-950': '#e0e7ff', 'text-indigo-900': '#e0e7ff', 'text-indigo-800': '#e0e7ff',
    'text-indigo-700': '#e0e7ff', 'text-indigo-600': '#c7d2fe', 'text-indigo-500': '#c7d2fe',
    'text-violet-700': '#ddd6fe', 'text-violet-600': '#c4b5fd', 'text-purple-700': '#e9d5ff',
    'text-purple-600': '#d8b4fe', 'text-emerald-800': '#a7f3d0', 'text-emerald-700': '#6ee7b7',
    'text-emerald-600': '#6ee7b7', 'text-green-700': '#86efac', 'text-green-600': '#86efac',
    'text-rose-900': '#ffe4e6', 'text-red-900': '#fee2e2', 'text-amber-900': '#fef3c7', 'text-emerald-900': '#d1fae5',
    'text-sky-900': '#e0f2fe', 'text-violet-900': '#ede9fe', 'text-blue-900': '#dbeafe',
    'text-rose-800': '#fecdd3', 'text-rose-700': '#fda4af', 'text-rose-600': '#fda4af',
    'text-red-800': '#fecaca', 'text-red-700': '#fca5a5', 'text-red-600': '#fca5a5',
    'text-amber-800': '#fde68a', 'text-amber-700': '#fcd34d', 'text-amber-600': '#fcd34d',
    'text-orange-700': '#fdba74', 'text-orange-600': '#fdba74', 'text-sky-700': '#7dd3fc',
    'text-sky-600': '#7dd3fc', 'text-blue-700': '#93c5fd', 'text-blue-600': '#93c5fd',
}
for t, c in TEXT.items():
    with_hover(t, f'color: {c}')

BORDER = {
    'border-slate-100': 0.12, 'border-slate-200': 0.18, 'border-slate-300': 0.26,
    'border-gray-200': 0.18, 'border-indigo-100': 0.28, 'border-indigo-200': 0.34,
    'border-indigo-300': 0.45,
}
for t, a in BORDER.items():
    with_hover(t, f'border-color: rgba(165,180,252,{a})')
for color, rgb in {
    'emerald': '16,185,129', 'green': '34,197,94', 'rose': '244,63,94', 'red': '239,68,68',
    'amber': '245,158,11', 'orange': '249,115,22', 'violet': '139,92,246', 'purple': '168,85,247',
    'sky': '14,165,233', 'blue': '59,130,246',
}.items():
    for shade in ('100', '200', '300'):
        with_hover(f'border-{color}-{shade}', f'border-color: rgba({rgb},0.4)')

for t, a in {'divide-slate-100': 0.12, 'divide-slate-200': 0.18}.items():
    rules.append(f'{S} [class~="{t}"] > :not(:last-child) {{ border-color: rgba(165,180,252,{a}) }}')

for t in ('from-white', 'via-white', 'to-white', 'from-slate-50', 'to-slate-50', 'via-slate-50'):
    prop = '--tw-gradient-' + t.split('-')[0]
    tok(t, f'{prop}: rgba(22,20,68,0.72)')
for t in ('from-indigo-50', 'to-indigo-50', 'via-indigo-50'):
    prop = '--tw-gradient-' + t.split('-')[0]
    tok(t, f'{prop}: rgba(99,102,241,0.16)')

for t in ('ring-white', 'ring-slate-50', 'ring-slate-100', 'ring-indigo-50', 'ring-indigo-100'):
    tok(t, '--tw-ring-color: rgba(165,180,252,0.12)')

rules.append(f'{S} [class~="placeholder:text-slate-400"]::placeholder {{ color: #c3c9f7 }}')
rules.append(f'{S} [class~="placeholder:text-slate-500"]::placeholder {{ color: #c3c9f7 }}')
rules.append(f'{S} input::placeholder, {S} textarea::placeholder {{ color: #c3c9f7 }}')
rules.append(f'{S} option {{ background-color: #1e1b4b; color: #eef2ff }}')

header = """/* Generated by gen_theme.py - remaps light-mode utilities onto the dark indigo glass palette.
   Unlayered on purpose: it must win over Tailwind's layered utilities inside `.app-theme`. */
.app-theme { color-scheme: dark; color: #f1f3ff; }
"""
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(header + '\n'.join(rules) + '\n')
print(len(rules), 'rules')
