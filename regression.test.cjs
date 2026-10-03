// Synthetic fixtures only; no user session exports.
// Run with: node regression.test.cjs. No dependencies or network requests.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(__dirname + '/content.js', 'utf8');
const exposed = source.slice(0, source.indexOf('  const panel =')) + '\n window.test = {extractJPlayers,parseRecentPlayerMatches,parsePlayerInfo,parsePlayerStats,parsePlayerContract,mergePlayerDetails,domText,collectLinks,rosterCompact,playerIds,parseManagerCore,deepPlayerScan,collectOwnTeam,collectOpponent,pickMatches,safeBodyText,clubNumber,parseClubFinances,parseClubDeals,parseTeamStatistics,collectClubData, mockCollectors: (display,current,opponent,profile,clubDocs={},requests=[]) => { document=display; setStatus=()=>{}; nearestOpponentRosterUrl=()=>ORIGIN+"/roster.php?num=12345"; fetchDoc=async url=>{requests.push(url);return clubDocs[new URL(url).searchParams.get("pm")] || (/player_(stats|contracts)\.php/.test(url)?clubDocs[new URL(url).pathname]:url.includes("player.php")?profile:url.includes("sort=300")?current:url.includes("roster.php")?opponent:display);}; fetchMatches=async()=>[]; }, mockDeep: (fixture,requests) => { setStatus = () => {}; fetchDoc = async url => { requests.push(url); return fixture; }; }};})();';
const context = {window:{}, location:{origin:'https://vfliga.com',href:'https://vfliga.com/managerzone.php',pathname:'/managerzone.php'}, URL, Map, Set};
vm.runInNewContext(exposed, context);
const t = context.window.test;
function text(value) { return {nodeType:3,nodeValue:String(value)}; }
function node(tag, value='', attrs={}, children=[]) {
  const n = {nodeType:1,tagName:tag.toUpperCase(),attrs,children,childNodes: value ? [text(value),...children] : children,
    getAttribute(k) {return this.attrs[k] ?? null;},
    closest(tag){let n=this;while(n){if(n.tagName===tag.toUpperCase())return n;n=n.parent;}return null;},
    matches(selector) { return selector.split(',').some(s=>s.trim()===this.tagName.toLowerCase() || s.trim()==='[hidden]' && 'hidden' in this.attrs || /display/.test(s) && /display\s*:\s*none/.test(this.attrs.style||'')); },
    querySelector(selector) {return this.querySelectorAll(selector)[0]||null;},
    querySelectorAll(selector) {
      const descendants = this.children.flatMap(c=>[c,...(c.descendants||[])]);
      return descendants.filter(c=>selector.split(',').some(s=>{
        s=s.trim();
        if(['script','style','noscript'].includes(s))return c.tagName===s.toUpperCase();
        if(s.startsWith('#'))return c.attrs.id===s.slice(1);
        if(s==='td'||s==='th') return c.tagName===s.toUpperCase();
        if(s==='[title]')return 'title' in c.attrs;
        if(s==='option:checked')return c.tagName==='OPTION'&&c.selected;
        if(s==='option[selected]')return c.tagName==='OPTION'&&'selected' in c.attrs;
        if(s==='select[name="season"]')return c.tagName==='SELECT'&&c.attrs.name==='season';
        if(s==='select option')return c.tagName==='OPTION';
        if(s==='div.txt2')return c.tagName==='DIV'&&c.attrs.class==='txt2';
        if(['img','fieldset'].includes(s))return c.tagName===s.toUpperCase();
        if(s==='tr'||s==='b')return c.tagName===s.toUpperCase();
        if(s==='table')return c.tagName==='TABLE';
        if(s==='a[href*="player.php?num="]')return c.tagName==='A'&&(c.attrs.href||'').includes('player.php?num=');
        if(s==='body')return c.tagName==='BODY';
        if(s==='a[href]')return c.tagName==='A'&&c.attrs.href;
        if(s.startsWith('tr[data-role='))return c.tagName==='TR'&&c.attrs['data-role']===s.match(/"([^"]+)"/)[1];
        return false;
      }));
    },cloneNode(){return node(this.tagName,this.childNodes.filter(c=>c.nodeType===3).map(c=>c.nodeValue).join(''),{...this.attrs},this.children.map(c=>c.cloneNode(true)));},remove(){if(this.parent){this.parent.children=this.parent.children.filter(c=>c!==this);this.parent.childNodes=this.parent.childNodes.filter(c=>c!==this);}} };
  Object.defineProperty(n,'descendants',{get:()=>n.children.flatMap(c=>[c,...(c.descendants||[])])});
  Object.defineProperty(n,'textContent',{get:()=>n.childNodes.map(c=>c.nodeType===3?c.nodeValue:c.textContent).join('')});
  n.children.forEach((c,i)=>{c.nextElementSibling=n.children[i+1]||null;c.parent=n;});
  if(n.tagName==='OPTION') n.selected='selected' in attrs;
  return n;
}
function documentWith(children, html='') {const root=node('html','',{},[node('body','',{},children)]);root.innerHTML=html;return {documentElement:root,querySelector:s=>root.querySelector(s),querySelectorAll:s=>root.querySelectorAll(s)};}
function field(label,value='',attrs={}) {return node('tr','',{},[node('td',label),node('td',value,attrs)]);}
const args = Array(59).fill(0);
Object.assign(args, {0:123456,1:12345,2:'Test',3:'Player',5:'Example Country',6:'CF',7:'CM',9:24,10:100,12:11,13:100,14:2,15:89,16:'Пк',17:'',18:'',19:'',52:4,53:2,54:1,55:0,56:0,57:6.5});
const playerLine = 'new jPlayer(' + args.map(v=>JSON.stringify(v)).join(',') + ')';
const doc=documentWith([],playerLine+';var sort=300');
const p=t.extractJPlayers(doc,'12345')[0];
assert.equal(p.fatigue,11);assert.equal(p.form,100);assert.equal(p.formTrend,'falling');assert.equal(p.realStrength,89);
assert.equal(p.selectedStats.averageRating,6.5);assert.equal(p.selectedStats.games,4);assert.equal(p.selectedStats.goals,2);assert.equal(p.selectedStats.assists,1);assert.equal(p.selectedStats.yellowCards,0);assert.equal(p.selectedStats.scope.sort,300);
assert.equal(t.extractJPlayers(doc,'54321').length,0);
const hidden=t.extractJPlayers(documentWith([],playerLine.replace('0,11,100,2,89','0,-1,0,0,100')),'12345')[0];
assert.equal(hidden.fatigue,null);assert.equal(hidden.form,null);
const infoDoc=documentWith([node('table','',{},[
  field('Усталость','11%'),field('Форма на сегодня','',{title:'100%, падает'}),field('Реальная сила','89'),
  field('Роль в команде','основной состав'),field('Полезность в этом сезоне','60% = 300 из 500 минут'),
  field('Игровая практика','10 300 мин | 9 240 мин | 8 180 мин'),field('Стиль',''),
  field('Лояльность','40'),field('Травматичность',''),field('Зарплата за тур','12 000'),
  field('Стоимость','5 000 000'),field('Играл подряд','2 матча')
]),node('div','В соревновательных матчах сезона сыграл: 300 мин.')]);
const info=t.parsePlayerInfo(infoDoc,'https://vfliga.com/player.php?num=123456','123456');
assert.equal(info.fatigue,11);assert.equal(info.form,100);assert.equal(info.style,null);assert.equal(info.injuryRisk,null);
assert.equal(info.salaryPerTour,12000);assert.equal(info.value,5000000);assert.equal(info.seasonMinutes,300);
assert.equal(info.usefulness.minutes,300);assert.equal(info.usefulness.targetMinutes,500);assert.equal(info.playedInRow,2);
function statsRow(role,values,attrs={}) {return node('tr','',{'data-role':role,...attrs}, values.map(v=>node('td',v)));}
const seasons=node('select','',{name:'season'},[node('option','50',{value:'50'}),node('option','60',{value:'60',selected:''}),node('option','все',{value:'-1'})]);
const total=statsRow('total',['','Суммарно во всех матчах:','6.6','5','2','3','8 (5)','1','0','-','']);
total.children[1].children.push(node('div','3'));total.children[1].childNodes.push(total.children[1].children[0]);
const statsDoc=documentWith([seasons,node('table','',{},[statsRow('mt',['','Товарищеские матчи','7','1','-','2','-','-','-','-','-'],{'data-mt':'1','data-group':'club'}),total])]);
const stats=t.parsePlayerStats(statsDoc,'stats','123456');
assert.equal(stats.season,60);assert.equal(stats.totalRating,6.6);assert.equal(stats.total.games,5);assert.equal(stats.total.assists,3);assert.equal(stats.tournaments[0].goals,0);
const merged=t.mergePlayerDetails({...p,fatigue:25,realStrength:99},info,stats,null);
assert.equal(merged.fatigue,25);assert.equal(merged.realStrength,99);assert.equal(merged.stats.seasonMinutes,300);assert.equal(merged.selectedStats.games,4);
const contractDoc=documentWith([node('div','Действующий контракт'),node('table','',{},[field('Команда:','Example FC'),field('Менеджер, заключивший контракт:','Example Manager'),field('Сезон подписания контракта:','60'),field('Срок:','до конца 62-го сезона'),field('Зарплата:','12 000')]),node('div','в контракте на 3 следующих сезона (до конца 63-го сезона) игрока точно устроит зарплата 14 000 за тур')]);
const contract=t.parsePlayerContract(contractDoc,'contracts','123456');
assert.equal(contract.current.team,'Example FC');assert.equal(contract.current.signedSeason,60);assert.equal(contract.current.salaryPerTour,12000);assert.equal(contract.renewal.requestedSalaryPerTour,14000);assert.equal(contract.renewal.availableTerm,'3 следующих сезона');
assert.equal(t.domText(node('div','secret',{style:'display:none'})),'');
const links=t.collectLinks(documentWith([node('a','Статистика',{href:'player_stats.php?num=123456'})]),'https://vfliga.com/player.php?num=123456');
assert.equal(links[0].text,'Статистика');
// One incidental direct link must not truncate the authoritative jPlayer roster.
const many = Array.from({length:28},(_,i)=>{const a=[...args];a[0]=200000+i;return 'new jPlayer('+a.map(JSON.stringify).join(',')+')';});
const opponentDoc=documentWith([node('a','Player',{href:'player.php?num=200000'})],many.join(';')+';'+many[0]);
const roster=t.rosterCompact(opponentDoc,'12345');
assert.equal(roster.players.length,28);
assert.deepEqual(Array.from(roster.playerIds),Array.from(roster.players,p=>p.id));
assert.deepEqual(Array.from(t.playerIds(opponentDoc,'12345')),Array.from(roster.playerIds));
assert.equal('stats' in p,false);assert.equal('rosterStats' in merged,false);
assert.equal(merged.selectedStats.games,4);assert.equal(merged.stats.total.games,5);
assert.equal(merged.selectedStats.scope.sort,300);
// Hidden public state, including the friendly fatigue placeholder, stays unknown.
for(const fatigue of [-1,25]) {
  const a=[...args];a[12]=fatigue;a[13]=0;a[14]=0;
  const hidden=t.extractJPlayers(documentWith([],'new jPlayer('+a.map(JSON.stringify).join(',')+')'))[0];
  assert.equal(hidden.fatigue,null);assert.equal(hidden.form,null);assert.equal(hidden.formTrend,null);
}
assert.equal('resources' in t.parseManagerCore(documentWith([node('div','Есть 8 изучений стилей, 7 роста силы, 30 изменений формы')])),false);
const cup=statsRow('mt',['','Synthetic Cup','-','2','-','?','-','-','-','-','-'],{'data-mt':'2','data-group':'club'});
const counter=node('div','3',{class:'txt2',style:'float:right'});
counter.parent=cup.children[1];cup.children[1].children.push(counter);cup.children[1].childNodes.push(counter);
const cleanStats=t.parsePlayerStats(documentWith([node('table','',{},[cup,total,statsRow('team',['','Not a tournament','8','100'])])]),'stats','123456');
assert.equal(cleanStats.tournaments.length,1);assert.equal(cleanStats.tournaments[0].tournament,'Synthetic Cup');
assert.equal(cleanStats.tournaments[0].averageRating,null);assert.equal(cleanStats.tournaments[0].goals,0);assert.equal(cleanStats.tournaments[0].assists,null);
assert.equal(cleanStats.total.games,5); // never recomputed from tournaments
// Club pages have a split day/date cell and separate ranking/change elements.
const tr=values=>node('tr','',{},values.map(v=>typeof v==='string'?node('td',v):v));
const td=value=>node('td',value);
const financeRow=(before,change,after)=>tr(['9',node('td','Example date',{title:'dh0'}),before,change,after,'Synthetic ledger event']);
const financeTable=node('table','',{},[tr(['День','Было','+/-','Стало','Вся финансовая история']),financeRow('2 000','-250','1 750'),financeRow('2 000','-250','1 750'),financeRow('?','?','')]);
const financeDoc=documentWith([seasons,financeTable],'var curr=12345;');
const ledger=t.parseClubFinances(financeDoc,'finance');
assert.equal(ledger.entries.length,2);assert.equal(ledger.entries[0].expense,250);assert.equal(ledger.entries[0].income,null);assert.equal(ledger.entries[1].balanceAfter,null);assert.equal(ledger.entries[1].expense,null);
assert.equal(ledger.season,60);assert.equal('balance' in ledger,false);
const dealHeader=tr(['День','Игрок','Нац','Поз','В','С','Спецвозможности','Из команды','%','Цена']);
const dealRow=()=>tr(['9',node('td','Example date',{title:'dh0'}),node('td','tooltip noise',{},[node('a','Synthetic Player',{href:'player.php?num=200000'})]),'','CM','20','80','Пк','Synthetic FC','50%','1 250к']);
const dealTable=section=>node('table','',{},[tr([node('td','',{},[node('b',section)])]),dealHeader.cloneNode(true),dealRow(),dealRow()]);
const dealsDoc=documentWith([seasons,dealTable('Куплены на трансферном рынке'),dealTable('Не удалось купить на трансферном рынке'),dealTable('Игроки, пришедшие из спортшколы')],'var curr=12345;');
const deals=t.parseClubDeals(dealsDoc,'https://vfliga.com/managerzone.php?pm=4');assert.equal(deals.transactions.length,1);assert.equal(deals.transactions[0].amount,1250000);assert.equal(deals.transactions[0].playerId,'200000');assert.equal(deals.transactions[0].playerName,'Synthetic Player');assert.equal(deals.transactions[0].counterparty,'Synthetic FC');
const rank=(place,change)=>node('td','',{},[node('div','99',{title:'<b>'+change+'</b> места за сезон'}),node('a',place,{href:'statistics.php'})]);
const metricRow=(view,label,value)=>tr([node('td','',{},[node('a',label,{href:'managerzone.php?pm=3&view='+view})]),node('td','99',{},[node('a',value,{href:'managerzone.php?pm=3&view='+view})]),rank('123','-7'),rank('45','+3'),rank('','?'),rank('8','0')]);
const rankingDoc=documentWith([node('table','',{},[tr(['Статистический показатель','Место']),tr(['лига','континент','страна','дивизион']),metricRow(1,'Рейтинг посещаемости:','1,25'),metricRow(8,'Vs','9000'),metricRow(15,'В кассе команды:','999999'),metricRow(14,'Стоимость игроков','5 000 000'),metricRow(25,'(в %)','70,5 %')])],'var curr=12345;');
const ranks=t.parseTeamStatistics(rankingDoc,'https://vfliga.com/managerzone.php?pm=3').metrics;
assert.equal(ranks.attendanceRating.value,1.25);assert.equal(ranks.attendanceRating.ranking.league.place,123);assert.equal(ranks.attendanceRating.ranking.league.change,-7);assert.equal(ranks.attendanceRating.ranking.continent.change,3);assert.equal(ranks.attendanceRating.ranking.country.place,null);assert.equal(ranks.attendanceRating.ranking.country.change,null);assert.equal(ranks.vsRanking.league.place,123);assert.equal('value' in ranks.vsRanking,false);assert.equal('value' in ranks.financeRanking,false);assert.equal(ranks.playerValueShare.value,70.5);
for(const raw of ['', '-', '?','123foo'])assert.equal(t.clubNumber(raw),null);
assert.equal(t.clubNumber('0'),0);
const malformedDeals=dealsDoc.documentElement.cloneNode(true);
const prices=malformedDeals.querySelectorAll('table').flatMap(table=>table.querySelectorAll('tr')).filter(row=>row.children.length===11);
for(const row of prices){row.children[10].childNodes=[text('?')];}
assert.equal(t.parseClubDeals({documentElement:malformedDeals,querySelector:s=>malformedDeals.querySelector(s)},'https://vfliga.com/managerzone.php?pm=4').transactions[0].amount,null);
assert.equal(Object.keys(t.parseTeamStatistics(documentWith([]),'https://vfliga.com').metrics).length,0);
assert.equal(t.parseClubFinances(documentWith([]),'https://vfliga.com').entries.length,0);
// Minimal synthetic fixtures using the confirmed 16-column player.php table.
const matchHeader=tr(['Дата','Матч','','Сч','Турнир','Стадия',node('td','Поз',{title:'Позиция'}),'С','Ф','У','П',node('td','Г',{title:'Голы'}),'Крт','Доп','Оц',node('td','М',{title:'Сыграл минут'})]);
function playerMatch(day,{rating='6.5',minutes='90',position='CM',cards=[],goals='-',assists='-'}={}) {
  return tr(['Synthetic date '+day,node('td','counter noise',{},[node('a','Synthetic FC',{href:'managerzone.php'}),node('a','Other FC',{href:'roster.php?num=98765'})]),'В',node('td','',{},[node('a','2:1',{href:'viewmatch.php?day='+day+'&match_id='+day})]),'Synthetic Cup','1 тур',position,'88','-','-',assists,goals,node('td','',{},cards),'',rating,minutes]);
}
const matchTable=node('table','',{},[matchHeader,playerMatch(100),playerMatch(101,{rating:'?',minutes:'?',position:'S2'}),playerMatch(102,{goals:'1',assists:'2',cards:[node('img','',{title:'Желтая карточка'})]}),playerMatch(99)]);
const deepProfile=documentWith([infoDoc.documentElement.cloneNode(true),node('a','Статистика',{href:'player_stats.php?num=123456'}),node('a','Контракт',{href:'player_contracts.php?num=123456'}),matchTable]);
const recent=t.parseRecentPlayerMatches(deepProfile,'https://vfliga.com/player.php?num=123456',2,'12345');
assert.equal(recent.length,2);assert.ok(recent[0].matchUrl.includes('day=102'));
assert.equal(recent[0].opponentId,'98765');assert.equal(recent[0].opponent,'Other FC');assert.equal(recent[0].homeAway,'home');assert.equal(recent[0].minutes,90);assert.equal(recent[0].rating,6.5);assert.equal(recent[0].goals,1);assert.equal(recent[0].assists,2);assert.equal(recent[0].yellowCards,1);assert.equal(recent[0].redCards,0);
assert.equal(recent[1].rating,null);assert.equal(recent[1].minutes,null);assert.equal(recent[1].goals,null);assert.equal(recent[1].yellowCards,null);
assert.equal(t.parseRecentPlayerMatches(deepProfile,'https://vfliga.com/player.php',10,'12345')[2].goals,0);
const gkHeader=matchHeader.cloneNode(true);gkHeader.children[11].attrs.title='Пропущенные голы';
assert.equal(t.parseRecentPlayerMatches(documentWith([node('table','',{},[gkHeader,playerMatch(1,{goals:'3',position:'GK'})])]),'https://vfliga.com/player.php',10,'12345')[0].goals,null);
const unknownCard=playerMatch(1,{cards:[node('img','',{title:'unknown'})]});
assert.equal(t.parseRecentPlayerMatches(documentWith([node('table','',{},[matchHeader.cloneNode(true),unknownCard])]),'https://vfliga.com/player.php',10,'12345')[0].yellowCards,null);
const historyRow=(season,day,date,salary)=>tr([node('td',season,{title:'Сезон: '+season}),node('td',day,{title:'День: '+day}),date,'Example FC','1 след. сезон','61','300','Synthetic end',salary]);
const expandedContractDoc=documentWith([node('table','',{},[field('Команда:','Example FC'),field('Менеджер, заключивший контракт:','Example Manager'),field('Сезон подписания контракта:','60'),field('День подписания:','5'),field('Дата подписания:','Synthetic signing'),field('Срок:','до конца текущего сезона'),field('Зарплата:','12 000')]),node('span','1 следующий сезон',{id:'sdescr'}),node('span','4 800',{id:'hgreen'}),node('td','Итого: требования игрока меньше базовых на 18%'),node('fieldset','',{},[-30,-10,-3,12,20].map((percent,i)=>node('div','Synthetic factor '+i+':',{},[node('div',(percent>0?'+':'')+percent+'%')]))),node('table','',{},[tr(['Дата подписания','Команда','Срок','Дата окончания','Зарплата']),historyRow('60','5','Synthetic signing','12 000'),historyRow('59','8','Previous signing','8 000')])]);
const expanded=t.parsePlayerContract(expandedContractDoc,'contracts','123456');
assert.equal(expanded.renewal.requestedSalaryPerTour,4800);assert.equal(expanded.renewal.adjustmentPercent,-18);assert.equal(expanded.renewal.baseSalaryNextSeason,null);assert.deepEqual(Array.from(expanded.renewal.factors,f=>f.percent),[-30,-10,-3,12,20]);assert.equal(expanded.renewal.factors[0].label,'Synthetic factor 0');
assert.equal(expanded.history.length,2);assert.equal(expanded.history[1].salaryPerTour,8000);assert.equal(expanded.current.salaryPerTour,12000);assert.equal(expanded.current.endsAt,'Synthetic end');assert.equal(expanded.current.signedDay,5);
const missingContract=t.parsePlayerContract(documentWith([]),'contracts','123456');assert.equal(missingContract.current.salaryPerTour,null);assert.equal(missingContract.renewal.adjustmentPercent,null);assert.equal(missingContract.history.length,0);
assert.equal(t.mergePlayerDetails({...p,fatigue:null,form:null},info,null,null,'opponent').fatigue,null);
// Exercise the actual deep loop over every roster ID, without network or delays.
context.setTimeout=fn=>fn();
context.document=doc;
context.window.requests=[];t.mockDeep(deepProfile,context.window.requests);
t.deepPlayerScan(roster,'Synthetic opponent',id=>'https://vfliga.com/player.php?num='+id,{mode:'opponent',maxMatches:2,teamId:'12345'}).then(async details=>{
  assert.equal(details.length,28);assert.equal(context.window.requests.length,28);
  assert.deepEqual(Array.from(details,p=>p.playerId),Array.from(roster.playerIds));
  assert.equal(context.window.requests.some(u=>/player_(stats|contracts)\.php/.test(u)),false);
  for(const player of details){assert.equal('stats' in player,false);assert.equal('contract' in player,false);assert.equal(player.info.recentMatches.length,2);}
  const ownDisplay=documentWith([],playerLine+';var curr=12345;var sort=1;');
  const ownCurrent=documentWith([node('div','Финансы: 5 000'),node('div','Рейтинг силы команды (Vs): 100')],playerLine+';var curr=12345;var sort=300;');
  const requests=[];
  t.mockCollectors(ownDisplay,ownCurrent,opponentDoc,deepProfile,{6:financeDoc,4:dealsDoc,3:rankingDoc,'/player_stats.php':statsDoc,'/player_contracts.php':expandedContractDoc},requests);
  for(const depth of ['normal','deep']) {
    const ownBefore=requests.length;
    const own=await t.collectOwnTeam(1,depth);
    const ownPlayerRequests=requests.slice(ownBefore).filter(u=>/\/player(?:_stats|_contracts)?\.php/.test(u));
    assert.equal(ownPlayerRequests.length,depth==='deep'?3:0);
    if(depth==='deep'){assert.equal(own.playerDetails[0].stats.total.games,5);assert.equal(own.playerDetails[0].contract.renewal.adjustmentPercent,-18);assert.equal(own.playerDetails[0].info.recentMatches.length,1);}
    assert.equal(own.clubDataIncluded,false);assert.equal(own.team.finance,5000);assert.equal(own.team.ratings.vs,100);assert.equal('resources' in own.team,false);
    for(const key of ['finances','deals','teamStatistics'])assert.equal(key in own,false);
    assert.equal(requests.some(url=>/[?&]pm=(3|4|6)(?:&|$)/.test(url)),false);
    assert.equal(own.roster.players.length,1);assert.equal(own.roster.players[0].fatigue,11);
    assert.equal(own.roster.players[0].selectedStats.scope.sort,1);
    if(depth==='deep')assert.equal(own.playerDetails[0].selectedStats.scope.sort,1);
    const withClub=await t.collectOwnTeam(1,depth,true);
    assert.equal(withClub.clubDataIncluded,true);
    assert.equal(withClub.finances.entries.length,2);assert.equal(withClub.deals.transactions.length,1);
    assert.deepEqual(JSON.parse(JSON.stringify(withClub.team)),JSON.parse(JSON.stringify(own.team)));
    assert.equal('playerDetails' in withClub,depth==='deep');
    const before=requests.length;
    const opponent=await t.collectOpponent(1,depth,true);
    for(const key of ['finances','deals','teamStatistics','clubDataIncluded'])assert.equal(key in opponent,false);
    assert.equal(requests.slice(before).some(url=>/[?&]pm=(3|4|6)(?:&|$)/.test(url)),false);
    assert.equal(opponent.roster.playerIds.length,28);
    assert.equal(requests.slice(before).filter(u=>/\/player(?:_stats|_contracts)?\.php/.test(u)).length,depth==='deep'?28:0);
    assert.equal(requests.slice(before).some(u=>/player_(stats|contracts)\.php/.test(u)),false);
    if(depth==='deep'){assert.equal(opponent.playerDetails.length,28);for(const player of opponent.playerDetails){assert.equal('stats' in player,false);assert.equal('contract' in player,false);assert.equal(player.info.recentMatches.length,1);}}
    requests.length=0;
  }
  t.mockCollectors(ownDisplay,ownCurrent,opponentDoc,infoDoc,{6:documentWith([],'var curr=99999;')});
  await assert.rejects(t.collectOwnTeam(1,'normal',true),/Активная команда изменилась/);
  const matches=t.pickMatches(documentWith([node('a','played',{href:'viewmatch.php?day=10'}),node('a','preview',{href:'previewmatch.php?day=11'})]),'https://vfliga.com',10);
  assert.equal(matches.length,1);assert.ok(matches[0].url.includes('/viewmatch.php?'));
  assert.equal(t.safeBodyText(documentWith([node('script','ws_token=synthetic-secret'),node('div','synthetic-chat',{id:'chat_txt'}),node('div','safe')])), 'safe');
  assert.equal((source.match(/id="vfl-club-data"/g)||[]).length,1);
  assert.ok(source.includes('run.busy = true'));assert.ok(source.includes('if (run.busy) return'));
  console.log('PASS: own 3 requests/player, opponent 28 profiles without stats/contracts, normal no deep requests, recent matches N and nulls, renewal factors/history, synthetic roster IDs, selectedStats separation, optional club modules, ledger, deals and rankings, tournament cleanup, unknown values, profile, season, totals, contracts and links.');
}).catch(error=>{console.error(error);process.exitCode=1;});
