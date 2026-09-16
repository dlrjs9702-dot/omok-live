from pathlib import Path
p = Path('public/styles.css')
s = p.read_text()
s += '''

/* v1.6.6: persistent announcement tab above lobby and collapsed guidance. */
.noticeCard{margin:0 0 16px;padding:0 18px 14px;border-radius:17px}
.noticeBar{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:52px}
.noticeTab{display:flex;align-items:center;gap:9px;padding:9px 5px;background:transparent;color:#f8fafc;font-size:.99rem;text-align:left}
.noticeTab:hover:not(:disabled){transform:none;color:#bfdbfe}
.noticeTab:focus-visible,.helpDisclosure summary:focus-visible,.gameRuleDetails summary:focus-visible,.announcementDetails summary:focus-visible,.roomRuleDetails summary:focus-visible{outline:2px solid #60a5fa;outline-offset:3px;border-radius:5px}
.noticeCount{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:2px 6px;border-radius:999px;color:#bfdbfe;background:#172554;font-size:.74rem}
.noticePanel{padding-top:3px;border-top:1px solid #263246}
.announcementList{display:grid;gap:6px;max-height:360px;overflow-y:auto;scrollbar-width:thin;margin-top:9px}
.announcementRow{border:1px solid #263246;background:#0e1729;border-radius:10px;padding:9px 12px;min-width:0}
.announcementHead{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.announcementHead strong{font-size:.84rem;overflow-wrap:anywhere;min-width:0}
.announcementHead time{color:#94a3b8;white-space:nowrap;font-size:.68rem}
.announcementDetails{margin-top:5px}
.announcementDetails summary,.helpDisclosure summary,.gameRuleDetails summary,.roomRuleDetails summary{color:#93c5fd;cursor:pointer;list-style:none;font-size:.73rem;font-weight:800;user-select:none}
.announcementDetails summary::-webkit-details-marker,.helpDisclosure summary::-webkit-details-marker,.gameRuleDetails summary::-webkit-details-marker,.roomRuleDetails summary::-webkit-details-marker{display:none}
.announcementDetails p{white-space:pre-wrap;overflow-wrap:anywhere;color:#e2e8f0;line-height:1.65;font-size:.83rem;margin:10px 0 4px}
.announcementActions{display:flex;justify-content:flex-end;gap:6px;margin-top:5px}
.announcementActions button{padding:4px 8px;font-size:.65rem}
.noticeEmpty{margin:0;padding:12px 4px;color:#94a3b8;font-size:.82rem}
.noticeForm{display:grid;gap:7px;margin-top:12px;border:1px solid #334155;border-radius:12px;background:#0b1324;padding:14px}
.noticeForm strong{margin-bottom:3px}.noticeForm label{font-size:.77rem;font-weight:800;color:#cbd5e1}
.noticeForm input,.noticeForm textarea{display:block;width:100%;min-width:0;resize:vertical;font:inherit;color:#f8fafc;background:#111827;border:1px solid #334155;border-radius:9px;padding:10px;outline:none}
.noticeForm input:focus,.noticeForm textarea:focus{border-color:#60a5fa}
.noticeFormActions{display:flex;gap:8px;justify-content:flex-end;margin-top:5px}
.helpHeading{display:flex;flex-wrap:wrap;align-items:baseline;gap:5px 12px}
.helpHeading h2{flex:1 1 auto;margin:.12em 0 .24em}
.helpDisclosure{flex:0 0 auto;min-width:0}
.helpDisclosure[open]{flex-basis:100%}
.helpDisclosure p{font-size:.79rem;line-height:1.6;color:#cbd5e1;margin:5px 0 9px;overflow-wrap:anywhere}
.gamePicker{gap:9px;margin:13px 0 10px}
.gameOption{display:flex;flex-direction:column;min-width:0;gap:6px}
.gameOption[data-game-option="baseball"]{grid-column:1/-1}
.gameOption .gameChoice{display:flex;flex-direction:row;align-items:center;justify-content:center;width:100%;min-height:47px;text-align:center;padding:10px 8px;border-radius:10px}
.gameOption .gameChoice strong{font-size:.92rem}
.gameRuleDetails{min-width:0;align-self:flex-start;padding-left:3px}
.gameRuleDetails p{width:min(370px,calc(100vw - 75px));max-width:100%;white-space:normal;color:#cbd5e1;font-size:.76rem;line-height:1.58;overflow-wrap:anywhere;margin:7px 0 4px}
.gameOption[data-game-option="baseball"] .gameRuleDetails p{width:auto}
.lobbyChatHead>div:first-child{min-width:0;flex:1 1 auto}
.roomRuleDetails summary{font-size:.82rem}
.roomRuleDetails p{margin-top:9px}
@media(max-width:880px){.noticeCard{padding:0 14px 12px}}
@media(max-width:520px){.noticeCard{margin-bottom:10px;padding:0 11px 10px}.noticeBar{min-height:48px}.announcementRow{padding:8px}.announcementHead strong{font-size:.78rem}.announcementHead time{font-size:.62rem}.gamePicker{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.gameOption .gameChoice{min-height:43px}.helpHeading h2{font-size:1.12rem}}
'''
p.write_text(s)
pkg = Path('package.json')
source = pkg.read_text()
assert source.count('"version": "1.6.5"') == 1
pkg.write_text(source.replace('"version": "1.6.5"', '"version": "1.6.6"'))
print('Compact responsive notice/disclosure styles and version integrated')
