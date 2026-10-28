"""원본 Stitch의 Tailwind 설정과 랜딩 화면을 실행용 index.html에 가져옵니다."""
from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
source = (root / 'stitch_tripsplit_travel_expense_tracker/stitch_tripsplit_travel_expense_tracker/tripsplit_1/code.html').read_text(encoding='utf-8')
head = source.split('<head>', 1)[1].split('</head>', 1)[0]
head = re.sub(r'<style>.*?</style>', '', head, flags=re.S)
head = head.replace('tailwind.config = {', 'tailwind.config = { corePlugins: { preflight: false },')
head = head.replace('</title>', '</title><meta name="description" content="여행별 지출을 기록하고 참여자별 부담액과 송금 금액을 계산하는 TripSplit">')
hero = re.search(r'<section.*?</section>', source, re.S).group()
hero = re.sub(r'<!-- User Trust Metric -->.*?<!-- Right Mockup Column', '</div>\n<!-- Right Mockup Column', hero, flags=re.S)
hero = re.sub(r'<button.*?</button>', '<a class="btn" href="#trips">내 여행 목록 보기 →</a>', hero, count=1, flags=re.S)
hero = hero.replace('href="#"', 'href="#create"')
hero = hero.replace('정산 진행중', '미리보기 · 예시 데이터').replace('최소 송금 안내', '송금 안내 예시').replace('✨ 계좌 송금액 복사 완료!', '✨ 지출 기록부터 최종 정산까지')
hero = re.sub(r'₩([\d,]+)', r'\1원', hero)
hero = hero.replace('Split travel expenses, simply and fairly with friends.', '함께 쓴 여행 경비, 쉽고 정확하게 나누세요.')
html = '<!DOCTYPE html>\n<html lang="ko"><head>' + head + '<link rel="stylesheet" href="styles.css"><script type="module" src="js/app.js"></script></head><body>'
html += '<a class="sr-only" href="#app">본문으로 건너뛰기</a><header class="site-header"><div class="header-inner"><a class="brand" href="#home"><span class="brand-mark" aria-hidden="true">↗</span>TripSplit <span class="tag">TRIP</span></a><a class="btn gradient" href="#create">+ 새 여행 만들기</a><nav class="site-nav" id="navigation" aria-label="주 메뉴"></nav></div></header>'
html += '<main id="app" tabindex="-1"></main><div id="toast" role="status" hidden></div><footer>TripSplit · 여행의 추억은 함께, 정산은 깔끔하게<br>이 브라우저에만 저장되는 여행 가계부</footer>'
html += '<template id="landing-template">' + hero + '</template><noscript>TripSplit을 사용하려면 브라우저의 JavaScript를 허용해 주세요.</noscript></body></html>'
(root / 'index.html').write_text(html, encoding='utf-8')
print('index.html generated from original Stitch HTML')
