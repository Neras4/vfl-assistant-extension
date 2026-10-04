// Synthetic fixtures only; no user session exports.
// Run with: node regression.test.cjs. No dependencies or network requests.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(__dirname + '/content.js', 'utf8');
const exposed = source.slice(0, source.indexOf('  const panel =')) + '\n window.test = {extractJPlayers,parseRecentPlayerMatches,parsePlayerInfo,parsePlayerStats,parsePlayerContract,mergePlayerDetails,domText,collectLinks,rosterCompact,playerIds,parseManagerCore,parseRosterSeasonStats,deepPlayerScan,collectOwnTeam,collectOpponent,pickMatches,safeBodyText,clubNumber,parseClubFinances,parseClubDeals,parseTeamStatistics,collectClubData,parseTrainingCenter,parseTrainingHistory,parseScoutingCenter,parseScoutingHistory,parseFitnessCenter,parseFitnessHistory,collectManagement,managementForm,transferFilters,transferTradeDay,TRANSFER_POSITION_LABELS,transferUiFilters,transferSearchUrl,parseTransferSearch,parseTransferBids,collectTransferMarket,collectTransferBids,TRANSFER_SORTS, mockMarket:(docs,requests,current)=>{document=current;location.pathname=current?"/transferlist.php":"/managerzone.php";setStatus=()=>{};fetchDoc=async url=>{requests.push(url);return docs.shift();};}, mockCollectors: (display,current,opponent,profile,clubDocs={},requests=[]) => { document=display; setStatus=()=>{}; nearestOpponentRosterUrl=()=>ORIGIN+"/roster.php?num=12345"; fetchDoc=async url=>{requests.push(url);return clubDocs[new URL(url).pathname+"?page="+new URL(url).searchParams.get("page")] || clubDocs[new URL(url).pathname] || clubDocs[new URL(url).searchParams.get("pm")] || (/player_(stats|contracts)\.php/.test(url)?clubDocs[new URL(url).pathname]:url.includes("player.php")?profile:url.includes("sort=300")?current:url.includes("roster.php")?opponent:display);}; fetchMatches=async()=>[]; }, mockDeep: (fixture,requests) => { setStatus = () => {}; fetchDoc = async url => { requests.push(url); return fixture; }; }};})();';
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
        if(s==='[id]')return 'id' in c.attrs;
        if(s==='[title]')return 'title' in c.attrs;
        if(s==='option:checked')return c.tagName==='OPTION'&&c.selected;
        if(s==='option[selected]')return c.tagName==='OPTION'&&'selected' in c.attrs;
        if(s==='select[name="day"]')return c.tagName==='SELECT'&&c.attrs.name==='day';
        if(s==='option')return c.tagName==='OPTION';
        if(s==='select[name="season"]')return c.tagName==='SELECT'&&c.attrs.name==='season';
        if(s==='select option')return c.tagName==='OPTION';
        if(s==='div.txt2')return c.tagName==='DIV'&&c.attrs.class==='txt2';
        if(['img','fieldset','input','select'].includes(s))return c.tagName===s.toUpperCase();
        if(s==='tr'||s==='b')return c.tagName===s.toUpperCase();
        if(s==='table')return c.tagName==='TABLE';
        if(s==='a[href*="player.php?num="]')return c.tagName==='A'&&(c.attrs.href||'').includes('player.php?num=');
        if(s==='body')return c.tagName==='BODY';
        if(s==='a[href]')return c.tagName==='A'&&c.attrs.href;
        if(s.startsWith('tr[data-role='))return c.tagName==='TR'&&c.attrs['data-role']===s.match(/"([^"]+)"/)[1];
        return false;
      }));
    },cloneNode(){const copy=node(this.tagName,'',{...this.attrs},this.children.map(c=>c.cloneNode(true)));copy.childNodes=this.childNodes.map(c=>c.nodeType===3?text(c.nodeValue):copy.children[this.children.indexOf(c)]);return copy;},remove(){if(this.parent){this.parent.children=this.parent.children.filter(c=>c!==this);this.parent.childNodes=this.parent.childNodes.filter(c=>c!==this);}} };
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
// Management fixtures use confirmed headers/colspan expansion, never real users.
const mgPlayer=id=>node('a','Synthetic Player',{href:'player.php?num='+id});
const hiddenId=id=>node('input','',{name:'del_plr_id[0]',value:id,type:'hidden'});
const mgForm=title=>node('td','',{},[node('div','',{title})]);
const trainingHeader=tr(['','Игрок','Нац','Позиции','В','Сила','сТр','Спецвозможности',node('td','Дн',{title:'Дней на тренировке'}),node('td','%',{title:'Прогресс тренировки'}),'У','Ф','Ст','и/о','1','Персп.']);
const trainActiveRow=tr(['',node('td','',{},[hiddenId('200000')]),'Synthetic Player','','CD','20','80','700к','И4','0','0%','2','','','+1','+','']);
const trainHeaderText='Тренировочный центр Уровень: 7 Скорость тренировки: 70% - 130% за тур Осталось тренировок силы: 50 из 50 Одному игроку не более: 8 Осталось спецвозможностей: 6 из 7 Одному игроку не более: 2 Осталось совмещений: 3 из 3 1 замена позиции = 2 совмещения Игроков на тренировке: 1 из 5 Стоимость тренировок: Сила: 200 000 - 1 400 000 Спецвозможность: 700 000 Позиция: 400 000 - 800 000';
const trainDoc=documentWith([node('div',trainHeaderText),node('table','',{},[trainingHeader,trainActiveRow])],'var curr=12345;var arr_plr_basetraining={200000:[0,0,3,"И4",1]};');
const parsedTrain=t.parseTrainingCenter(trainDoc,'https://vfliga.com/mng_base_train.php');
assert.equal(parsedTrain.center.level,7);assert.equal(parsedTrain.center.speedPercentPerTour,null);assert.equal(parsedTrain.center.speedPercentRange.min,70);assert.equal(parsedTrain.center.speedPercentRange.max,130);
assert.equal(parsedTrain.center.resources.strength.remaining,50);assert.equal(parsedTrain.center.resources.strength.maxPerPlayer,8);assert.equal(parsedTrain.center.resources.specials.remaining,6);assert.equal(parsedTrain.center.resources.specials.total,7);assert.equal(parsedTrain.center.resources.specials.maxPerPlayer,2);assert.equal(parsedTrain.center.resources.positions.remaining,3);assert.equal(parsedTrain.center.resources.positions.total,3);assert.equal(parsedTrain.center.resources.positions.replacementCostUnits,2);
assert.equal(parsedTrain.center.capacity.currentPlayers,1);assert.equal(parsedTrain.center.capacity.maxPlayers,5);assert.equal(parsedTrain.center.costs.strengthMin,200000);assert.equal(parsedTrain.center.costs.strengthMax,1400000);assert.equal(parsedTrain.center.costs.special,700000);assert.equal(parsedTrain.center.costs.positionMin,400000);assert.equal(parsedTrain.center.costs.positionMax,800000);
assert.equal(parsedTrain.active.length,1);assert.equal(parsedTrain.active[0].playerId,'200000');assert.equal(parsedTrain.active[0].days,0);assert.equal(parsedTrain.active[0].progressPercent,0);assert.equal(parsedTrain.active[0].result,'И4');assert.equal(parsedTrain.active[0].trainingType,null);
assert.equal(t.parseTrainingCenter(documentWith([]),'https://vfliga.com').active.length,0);
const seasonSelect=name=>node('select','',{name},[node('option','59',{value:'59'}),node('option','60',{value:'60',selected:''})]);
const trainHistoryHeader=tr(['День','Дата','Игрок','Поз1','Поз2','В','С','Спецвозможности',node('td','Тренировка',{title:'Описание проведенной тренировки'}),'']);
const trainEvent=season=>tr([node('td',String(season),{title:'Сезон: '+season}),node('td','20',{title:'День: 20'}),'Synthetic date',node('td','',{},[mgPlayer('200000')]),'CD','CM','20','80','Км2','Км3','550 000']);
const trainHistoryDoc=documentWith([seasonSelect('a'),seasonSelect('b'),node('table','',{},[trainHistoryHeader,trainEvent(60),trainEvent(59)])],'var curr=12345;');
const trainHistory=t.parseTrainingHistory(trainHistoryDoc,'https://vfliga.com',60);assert.equal(trainHistory.length,1);assert.equal(trainHistory[0].result,'Км3');assert.equal(trainHistory[0].day,20);assert.equal(trainHistory[0].cost,550000);
const scoutHeader=tr(['','Игрок','Нац','Поз','В','С','У','Ф','Спецвозможности','Изучает','Сейчас','Будет','Т',node('td','%',{title:'Прогресс изучения'}),'и/о','1']);
const scoutRow=tr(['',node('td','',{},[hiddenId('200000')]),'Synthetic Player','','CM','20','80','3','','Км','рост силы',node('td','',{},[node('div','',{title:'где-то в промежутке от 1% до 50%'})]),node('td','',{},[node('div','',{title:'<ul>ambiguous tooltip</ul>'})]),'2','81','+1','']);
const scoutText='Скаут-центр Уровень: 2 Скорость изучения: 30% - 50% в день Осталось изучений стилей: 9 из 10 Осталось изучений роста силы: 7 из 8 Осталось изучений потери силы: 4 из 8 Осталось изучений травматичности: 8 из 8 Осталось изучений лояльности: 8 из 8 Стоимость любого изучения: 30 000';
const scoutDoc=documentWith([node('div',scoutText),node('table','',{},[scoutHeader,scoutRow])],'var curr=12345;');
const parsedScout=t.parseScoutingCenter(scoutDoc,'https://vfliga.com');assert.equal(parsedScout.center.level,2);assert.equal(parsedScout.center.speedPercent.min,30);assert.equal(parsedScout.center.speedPercent.max,50);assert.equal(parsedScout.center.costPerStudy,30000);
assert.deepEqual(Array.from(Object.values(parsedScout.resources),r=>r.remaining),[9,7,4,8,8]);assert.deepEqual(Array.from(Object.values(parsedScout.resources),r=>r.total),[10,8,8,8,8]);assert.equal(parsedScout.active[0].turns,2);assert.equal(parsedScout.active[0].progressPercent,81);assert.equal(parsedScout.active[0].currentValue,'где-то в промежутке от 1% до 50%');assert.equal(parsedScout.active[0].expectedValue,null);
const scoutHistoryDoc=documentWith([seasonSelect('season'),node('table','',{},[tr(['На изучении:']),tr(['Игрок','Изучение','Прогресс','Дней']),tr([node('td','',{},[mgPlayer('200000')]),'рост силы','81%','2'])]),node('table','',{},[tr(['Завершено изучений:']),tr(['Дата','Игрок','Изучение','Уровень']),tr(['Synthetic date',node('td','',{},[mgPlayer('200000')]),'рост силы','3 из 4']),tr(['Synthetic date',node('td','',{},[mgPlayer('200001')]),'стиль','?'])]),node('table','',{},[tr(['Отмены изучений:']),tr(['Synthetic date',node('td','',{},[mgPlayer('200002')]),'рост силы','Cancelled'])])],'var curr=12345;');
const scoutHistory=t.parseScoutingHistory(scoutHistoryDoc,'https://vfliga.com');assert.equal(scoutHistory.active[0].days,2);assert.equal(scoutHistory.completed.length,2);assert.equal(scoutHistory.completed[0].result.level,3);assert.equal(scoutHistory.completed[0].result.maxLevel,4);assert.equal(scoutHistory.completed[1].result,null);
const fitnessText='Центр физподготовки Уровень: 6 Усталость восстанавливается на 2% лучше Осталось изменений физ. формы: 26 из 26 Запланировано всего изменений: 1 В ближайший игровой день: 1';
const fitnessDoc=documentWith([node('div',fitnessText)],'var curr=12345;');
const parsedFitness=t.parseFitnessCenter(fitnessDoc,'https://vfliga.com');assert.equal(parsedFitness.center.level,6);assert.equal(parsedFitness.center.fatigueRecoveryBonusPercent,2);assert.equal(parsedFitness.center.changes.remaining,26);assert.equal(parsedFitness.center.changes.total,26);assert.equal(parsedFitness.center.changes.planned,1);assert.equal(parsedFitness.center.changes.nextGameDay,1);
const fitnessHeader=last=>tr([node('td','День',{colspan:'2'}),'Игрок','Ф','Поз','В','С','Спецвозможности','Было',last]);
const fitnessRow=(last,season=null)=>tr([node('td','32',season?{title:'Сезон: '+season}:{}),'Synthetic date',node('td','',{},[mgPlayer('200000')]),'','CM','20','80','Км',mgForm('112%, растёт'),last==='Ошибка'?node('td','Synthetic failure'):mgForm('112%, падает')]);
const fitnessHistoryDoc=documentWith([node('table','',{},[fitnessHeader('Будет'),fitnessRow('Будет')]),node('table','',{},[fitnessHeader('Стало'),fitnessRow('Стало')]),node('table','',{},[fitnessHeader('Ошибка'),fitnessRow('Ошибка')])],'var curr=12345;');
const fitnessHistory=t.parseFitnessHistory(fitnessHistoryDoc,'https://vfliga.com',60);assert.equal(fitnessHistory.planned.length,1);assert.equal(fitnessHistory.planned[0].oldForm.percent,112);assert.equal(fitnessHistory.planned[0].oldForm.trend,'rising');assert.equal(fitnessHistory.planned[0].newForm.trend,'falling');assert.equal(fitnessHistory.completed.length,0);assert.equal(fitnessHistory.cancelled.length,0);assert.equal(fitnessHistory.scopeWarnings.length,1);
// Guard against importing unknown or previous-season fitness history. Nonempty
// completed/cancelled production data remain unverified; explicit season labels
// below exercise filtering and the already-confirmed shared column layout only.
const scopedFitness=documentWith([node('table','',{},[fitnessHeader('Стало'),fitnessRow('Стало',60),fitnessRow('Стало',59)]),node('table','',{},[fitnessHeader('Ошибка'),fitnessRow('Ошибка',60)])]);
const scoped=t.parseFitnessHistory(scopedFitness,'https://vfliga.com',60);assert.equal(scoped.completed.length,1);assert.equal(scoped.cancelled[0].error,'Synthetic failure');assert.equal(t.managementForm(mgForm('unknown')),null);
const emptyFitness=t.parseFitnessHistory(documentWith([]),'https://vfliga.com',60);for(const key of ['planned','completed','cancelled'])assert.equal(emptyFitness[key].length,0);
const unknownScout=t.parseScoutingCenter(documentWith([]),'https://vfliga.com');assert.equal(unknownScout.center.level,null);assert.equal(unknownScout.resources.styles.remaining,null);
const managementDocs={'/mng_base_ch.php?page=2':fitnessHistoryDoc,'/mng_base_train.php':trainDoc,'/mng_base_train_history.php':trainHistoryDoc,'/mng_scout_styles.php':scoutDoc,'/mng_scout_styles_history.php':scoutHistoryDoc,'/mng_base_ch.php':fitnessDoc};
// The current/history fitness paths differ by query string; route separately.
const malformedTraining=trainActiveRow.cloneNode(true);malformedTraining.children[9].childNodes=[text('?')];malformedTraining.children[10].childNodes=[text('?')];
const malformedTrain=t.parseTrainingCenter(documentWith([node('table','',{},[trainingHeader.cloneNode(true),malformedTraining])]),'https://vfliga.com');assert.equal(malformedTrain.active[0].days,null);assert.equal(malformedTrain.active[0].progressPercent,null);
// Preserve interleaved text and spans as real DOM cloning does.
const wrapped=node('div','',{},[node('b','6'),node('b','7')]);wrapped.childNodes=[text('Осталось спецвозможностей: '),wrapped.children[0],text(' из '),wrapped.children[1]];
const wrappedTraining=t.parseTrainingCenter(documentWith([node('h1','Тренировочный центр'),wrapped]),'https://vfliga.com');assert.equal(wrappedTraining.center.resources.specials.remaining,6);assert.equal(wrappedTraining.center.resources.specials.total,7);
const missingLimitDoc=documentWith([node('div',trainHeaderText.replace('Одному игроку не более: 8','Одному игроку не более: неизвестно'))]);assert.equal(t.parseTrainingCenter(missingLimitDoc,'https://vfliga.com').center.resources.strength.maxPerPlayer,null);
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
  const seasonArgs=[...args];Object.assign(seasonArgs,{52:9,53:10,54:4,55:2,56:1,57:6.59});
  const seasonLine='new jPlayer('+seasonArgs.map(JSON.stringify).join(',')+')';
  const ownCurrent=documentWith([node('div','Финансы: 5 000'),node('div','Рейтинг силы команды (Vs): 100')],seasonLine+';var curr=12345;var sort=300;var tek_season=60;');
  const expectedSeason={scope:{label:'по всем турнирам',season:60,sort:300},players:[{playerId:'123456',averageRating:6.59,games:9,goals:10,assists:4,yellowCards:2,redCards:1}]};
  assert.deepEqual(JSON.parse(JSON.stringify(t.parseRosterSeasonStats(ownCurrent,t.rosterCompact(ownCurrent,'12345')))),expectedSeason);
  assert.throws(()=>t.parseRosterSeasonStats(ownDisplay,t.rosterCompact(ownDisplay,'12345')),/по всем турнирам/);
  assert.throws(()=>t.parseRosterSeasonStats(documentWith([],'var sort=300'),{players:[]}),/по всем турнирам/);
  const incomplete=t.parseRosterSeasonStats(ownCurrent,{players:[{id:'777777',selectedStats:{games:0,goals:NaN,averageRating:-1}},{id:'888888',selectedStats:null}]});
  assert.equal(incomplete.players[0].games,0);assert.equal(incomplete.players[0].goals,null);assert.equal(incomplete.players[0].averageRating,null);assert.equal(incomplete.players[1].assists,null);
  const requests=[];
  t.mockCollectors(ownDisplay,ownCurrent,opponentDoc,deepProfile,{6:financeDoc,4:dealsDoc,3:rankingDoc,'/player_stats.php':statsDoc,'/player_contracts.php':expandedContractDoc},requests);
  for(const depth of ['normal','deep']) {
    const ownBefore=requests.length;
    const own=await t.collectOwnTeam(1,depth);
    assert.deepEqual(JSON.parse(JSON.stringify(own.rosterSeasonStats)),expectedSeason);
    const ownRequests=requests.slice(ownBefore);
    assert.equal(ownRequests.filter(u=>new URL(u).pathname==='/managerzone.php'&&new URL(u).searchParams.get('sort')==='300').length,1);
    assert.equal(ownRequests.length,depth==='deep'?5:2); // Reuse the existing state snapshot: zero extra HTTP requests.
    assert.equal(own.roster.players[0].selectedStats.games,4);assert.equal(own.rosterSeasonStats.players[0].games,9);
    const ownPlayerRequests=requests.slice(ownBefore).filter(u=>/\/player(?:_stats|_contracts)?\.php/.test(u));
    assert.equal(ownPlayerRequests.length,depth==='deep'?3:0);
    if(depth==='deep'){assert.equal(own.playerDetails[0].stats.total.games,5);assert.equal(own.playerDetails[0].contract.renewal.adjustmentPercent,-18);assert.equal(own.playerDetails[0].info.recentMatches.length,1);}
    assert.equal(own.managementIncluded,false);assert.equal('management' in own,false);
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
    for(const key of ['finances','deals','teamStatistics','clubDataIncluded','managementIncluded','management'])assert.equal(key in opponent,false);
    assert.equal(requests.slice(before).some(url=>/[?&]pm=(3|4|6)(?:&|$)/.test(url)),false);
    assert.equal('rosterSeasonStats' in opponent,false);assert.equal(requests.slice(before).some(u=>new URL(u).searchParams.get('sort')==='300'),false);
    assert.equal(opponent.roster.playerIds.length,28);
    assert.equal(requests.slice(before).filter(u=>/\/player(?:_stats|_contracts)?\.php/.test(u)).length,depth==='deep'?28:0);
    assert.equal(requests.slice(before).some(u=>/player_(stats|contracts)\.php/.test(u)),false);
    if(depth==='deep'){assert.equal(opponent.playerDetails.length,28);for(const player of opponent.playerDetails){assert.equal('stats' in player,false);assert.equal('contract' in player,false);assert.equal(player.info.recentMatches.length,1);}}
    requests.length=0;
  }
  // Fixed six requests, independent Management/Club Data for normal and deep.
  for(const depth of ['normal','deep'])for(const club of [false,true])for(const management of [false,true]) {
    const transport={...managementDocs,6:financeDoc,4:dealsDoc,3:rankingDoc,'/player_stats.php':statsDoc,'/player_contracts.php':expandedContractDoc};
    const req=[];t.mockCollectors(ownDisplay,ownCurrent,opponentDoc,deepProfile,transport,req);
    const own=await t.collectOwnTeam(2,depth,club,management);
    assert.equal(own.managementIncluded,management);assert.equal('management' in own,management);assert.equal(own.clubDataIncluded,club);assert.equal('finances' in own,club);
    assert.equal(req.filter(u=>/\/mng_/.test(u)).length,management?6:0);
    assert.equal(req.some(u=>/\/transferlist\.php/.test(u)),false); // Search never joins the team snapshot.
    assert.equal(req.filter(u=>/\/player(?:_stats|_contracts)?\.php/.test(u)).length,depth==='deep'?3:0);
    assert.equal('resources' in own.team,false);
    if(management){assert.deepEqual(Object.keys(own.management),['training','scouting','fitness']);assert.equal(own.management.training.active.length,1);assert.equal(own.management.training.history.length,1);assert.equal(own.management.scouting.active[0].days,2);assert.equal(own.management.fitness.planned.length,1);assert.ok(req.some(u=>u.endsWith('a=60&b=60')));assert.ok(req.some(u=>u.endsWith('season=60')));}
    const before=req.length;const opponent=await t.collectOpponent(2,depth,true,true);
    assert.equal('management' in opponent,false);assert.equal('managementIncluded' in opponent,false);assert.equal(req.slice(before).some(u=>/\/mng_/.test(u)),false);
    assert.equal(req.some(u=>/player_events|scout_forma|season=59/.test(u)),false);
  }
  const largeDisplay=documentWith([],many.join(';')+';var curr=12345;var sort=1;var tek_season=60;');
  const largeCurrent=documentWith([],many.join(';')+';var curr=12345;var sort=300;var tek_season=60;');
  const largeRequests=[];t.mockCollectors(largeDisplay,largeCurrent,opponentDoc,deepProfile,managementDocs,largeRequests);
  const largeOwn=await t.collectOwnTeam(2,'normal',false,true);assert.equal(largeOwn.roster.players.length,28);assert.equal(largeOwn.rosterSeasonStats.players.length,28);assert.deepEqual(Array.from(largeOwn.rosterSeasonStats.players,p=>p.playerId),Array.from(largeOwn.roster.playerIds));assert.equal(largeRequests.filter(u=>/\/mng_/.test(u)).length,6);assert.equal(largeRequests.some(u=>/\/player(?:_stats|_contracts)?\.php/.test(u)),false);
  const failureRequests=[];t.mockCollectors(ownDisplay,ownCurrent,opponentDoc,deepProfile,{...managementDocs,'/mng_scout_styles.php':documentWith([],'var curr=99999;')},failureRequests);
  await assert.rejects(t.collectOwnTeam(2,'normal',false,true),/Активная команда изменилась/);
  const oldHistoryDoc=documentWith([node('select','',{name:'season'},[node('option','59',{value:'59',selected:''})])],'var curr=12345;');
  t.mockCollectors(ownDisplay,ownCurrent,opponentDoc,deepProfile,{...managementDocs,'/mng_scout_styles_history.php':oldHistoryDoc});
  await assert.rejects(t.collectOwnTeam(2,'normal',false,true),/выбран не текущий сезон/);
  t.mockCollectors(ownDisplay,ownCurrent,opponentDoc,infoDoc,{6:documentWith([],'var curr=99999;')});
  await assert.rejects(t.collectOwnTeam(1,'normal',true),/Активная команда изменилась/);
  const matches=t.pickMatches(documentWith([node('a','played',{href:'viewmatch.php?day=10'}),node('a','preview',{href:'previewmatch.php?day=11'})]),'https://vfliga.com',10);
  assert.equal(matches.length,1);assert.ok(matches[0].url.includes('/viewmatch.php?'));
  assert.equal(t.safeBodyText(documentWith([node('script','ws_token=synthetic-secret'),node('div','synthetic-chat',{id:'chat_txt'}),node('div','safe')])), 'safe');
  assert.equal((source.match(/id="vfl-club-data"/g)||[]).length,1);
  assert.ok(source.includes('run.busy = true'));assert.ok(source.includes('if (run.busy) return'));
  // Transfer form values/header layouts are confirmed on live VFL. All data below
  // is synthetic. Market (21 cells) and My Bids (20) have different hidden columns.
  const marketHeader=()=>tr([td('№'),td(''),td('Игрок'),node('td','Нац',{title:'Национальность игрока'}),node('td','Поз',{title:'Позиция игрока'}),node('td','В',{title:'Возраст игрока'}),node('td','С',{title:'Сила игрока'}),node('td','У',{title:'Усталость игрока'}),node('td','Ф',{title:'Форма игрока'}),node('td','Спец',{title:'Спецвозможности игрока'}),node('td','Стиль',{title:'Любимый стиль игрока'}),node('td','Рост',{title:'Рост силы игрока'}),node('td','Падение',{title:'Падение силы игрока'}),node('td','Травм',{style:'display:none'}),node('td','Лояльн',{style:'display:none'}),node('td','Команда',{style:'display:none'}),node('td','',{title:'Стоимость игрока'}),node('td','ЧЗ',{title:'Число заявок на покупку игрока (видят только VIP-менеджеры)'}),node('td','%',{title:'Начальная цена игрока на рынке (в %)'}),node('td','Цена',{title:'Начальная цена игрока на рынке (в тыс. всоликов)'}),td('')]);
  const marketRow=(id='900001')=>tr([node('td','',{},[node('a','1.',{href:'mng_orderplr.php?id='+id})]),node('td','',{},[node('img','',{title:'star_1'})]),node('td','',{},[node('img','',{title:'Находится на доске объявлений менее недели'}),node('a','Synthetic Market Player',{href:'mng_orderplr.php?id='+id})]),node('td','',{title:'Synthetic Country'},[node('div','',{title:'Synthetic Country'})]),'CM/CF','24','100','0',node('td','',{},[node('div','',{title:'117%, падает'})]),'Д4 Км3',node('td','',{},[node('img','',{title:'Спартаковский'})]),node('td','',{},[node('div','',{title:'где-то в промежутке от 31% до 99%'})]),node('td','',{},[node('div','',{title:'27%'})]),node('td','secret hidden',{style:'display:none'}),node('td','secret hidden',{style:'display:none'}),node('td','secret hidden',{style:'display:none'}),'33 489к',node('td','-',{title:'Нет заявок'}),'125%','41 861к','']);
  const marketDoc=(total=2527,rows=[marketRow()])=>documentWith([node('div',`Всего ${total} игроков. Показаны с ${total?1:0} по ${Math.min(total,50)}.`),node('table','',{},[marketHeader(),...rows]),node('script','ws_token=synthetic-secret'),node('div','synthetic-chat',{id:'chat_txt'})]);
  const transferForm=(label='сегодня, 22:00',value='26385')=>documentWith([node('select','',{name:'day'},[node('option',label,{value}),node('option','завтра, 22:00',{value:'26388',selected:''}),node('option','все игроки',{value:'-3'})])]);
  const form=transferForm();
  assert.equal(t.transferTradeDay(form),'26385');
  for(const bad of [transferForm('завтра, 22:00'),transferForm('сегодня, 22:00','-3'),documentWith([]),documentWith([node('select','',{name:'day'},[node('option','сегодня, 22:00',{value:'26385'}),node('option','сегодня, 23:00',{value:'26386'})])])])assert.throws(()=>t.transferTradeDay(bad),/сегодняшние торги/);
  for(const [id,label] of Object.entries({GK:'вратарь',XX:'полевой игрок',DF:'защитник',MD:'полузащитник',FW:'нападающий',R:'правый фланг',L:'левый фланг',C:'центр'}))assert.equal(t.TRANSFER_POSITION_LABELS[id],id+' — '+label);
  assert.ok(source.includes('${TRANSFER_POSITION_LABELS[p] || p}'));
  assert.ok(source.includes('type="checkbox" id="vfl-market-style-${i+1}"'));
  assert.equal(source.includes('<select id="vfl-market-style">'),false);
  const ui=documentWith([node('input','',{id:'vfl-market-style-4'}),node('input','',{id:'vfl-market-style-5'})]);ui.querySelector('#vfl-market-style-4').checked=true;ui.querySelector('#vfl-market-style-5').checked=true;
  t.mockMarket([],[],ui);assert.deepEqual(Array.from(t.transferUiFilters().styles),[4,5]);
  const input={position:'CM' ,age:{min:'18',max:'24'},price:{min:'0',max:'10 000'},strength:{min:'80',max:'100'},styles:[4,5],askingPercent:{min:'80',max:'120'}};
  const filters=t.transferFilters(input),query=new URL(t.transferSearchUrl(filters,null,'26385'));
  for(const [key,value] of Object.entries({pz1:'CM',minA:'18',maxA:'24',minS:'0',maxS:'10000',minP:'80',maxP:'100',minX:'80',maxX:'120',page:'1',status:'1',find_load:'1',sstyle:'1',day:'26385'}))assert.equal(query.searchParams.get(key),value);
  for(const position of ['GK','XX','DF','MD','FW','R','L','C','LD','CD','RD','LM','CM','RM','LF','CF','RF'])assert.equal(new URL(t.transferSearchUrl(t.transferFilters({position}),null,'26385')).searchParams.get('pz1'),position);
  for(let style=1;style<=6;style++){const params=new URL(t.transferSearchUrl(t.transferFilters({styles:[style]}),null,'26385')).searchParams;for(let id=1;id<=6;id++)assert.equal(params.get('plr_style_'+id),id===style?'1':'0');}
  const empty=t.transferFilters({}),emptyParams=new URL(t.transferSearchUrl(empty,null,'26385')).searchParams;
  for(const key of ['minA','maxA','minS','maxS','minP','maxP','minX','maxX'])assert.equal(emptyParams.get(key),'');
  for(let id=1;id<=6;id++)assert.equal(emptyParams.get('plr_style_'+id),'0');
  assert.equal(empty.age.min,null);assert.deepEqual(Array.from(empty.styles),[]);assert.equal('style' in empty,false);assert.equal(empty.position,null);
  assert.throws(()=>t.transferFilters({position:'BAD'}));for(const styles of [[0],[7],['4'],[1.5],Array(7).fill(1),'4'])assert.throws(()=>t.transferFilters({styles}));
  assert.deepEqual(Array.from(t.transferFilters({styles:[4,4,5]}).styles),[4,5]);
  for(const styles of [[],[4],[4,5],[1,2,3,4,5,6]]){const params=new URL(t.transferSearchUrl(t.transferFilters({styles}),null,'26385')).searchParams;for(let id=1;id<=6;id++)assert.equal(params.get('plr_style_'+id),styles.includes(id)?'1':'0');}
  assert.throws(()=>t.transferSearchUrl(empty));assert.throws(()=>t.transferSearchUrl(empty,null,'-3'));assert.throws(()=>t.transferFilters({age:{min:'24',max:'18'}}));assert.throws(()=>t.transferFilters({price:{min:'1e4'}}));assert.throws(()=>t.transferFilters({strength:{min:'?'}}));
  const market=t.parseTransferSearch(marketDoc(),'https://vfliga.com/transferlist.php');
  assert.equal(market.pagination.totalResults,2527);assert.equal(market.pagination.totalPages,51);assert.equal(market.pagination.page,1);assert.equal(market.pagination.shownFrom,1);assert.equal(market.pagination.shownTo,50);assert.equal(market.pagination.pageSize,50);
  const mp=market.players[0];assert.equal(mp.rank,1);assert.equal(mp.playerId,'900001');assert.equal(mp.playerName,'Synthetic Market Player');assert.equal(mp.playerUrl,null);assert.equal(mp.orderUrl,'https://vfliga.com/mng_orderplr.php?id=900001');assert.equal(mp.nationality,'Synthetic Country');assert.equal(mp.position,'CM/CF');assert.equal(mp.age,24);assert.equal(mp.strength,100);assert.equal(mp.fatigue,0);assert.equal(mp.form,117);assert.equal(mp.formTrend,'falling');assert.equal(mp.specials,'Д4 Км3');assert.equal(mp.style.id,1);assert.equal(mp.growth.min,31);assert.equal(mp.growth.max,99);assert.equal(mp.growth.level,null);assert.equal(mp.decline.percent,27);assert.equal(mp.value,33489000);assert.equal(mp.bidsCount,0);assert.equal(mp.askingPercent,125);assert.equal(mp.askingPrice,41861000);assert.ok(mp.statuses.includes('Находится на доске объявлений менее недели'));
  assert.equal(JSON.stringify(market).includes('synthetic-secret'),false);assert.equal(JSON.stringify(market).includes('secret hidden'),false);assert.equal(JSON.stringify(market).includes('synthetic-chat'),false);
  const malformed=marketRow('900002');malformed.children[5].childNodes=[text('?')];malformed.children[7].childNodes=[text('-')];malformed.children[8].children[0].attrs.title='Неизвестно';malformed.children[11].children[0].attrs.title='?';malformed.children[12].children[0].attrs.title='Неизвестно';malformed.children[18].childNodes=[text('∞')];malformed.children[10].children.push(node('img','',{title:'Британский'}));
  const partial=t.parseTransferSearch(marketDoc(2,[malformed]),'https://vfliga.com/transferlist.php').players[0];assert.equal(partial.age,null);assert.equal(partial.strength,100);assert.equal(partial.fatigue,null);assert.equal(partial.form,null);assert.equal(partial.growth.level,null);assert.equal(partial.growth.raw,'?');assert.equal(partial.decline.percent,null);assert.equal(partial.askingPercent,null);assert.equal(partial.raw.askingPercent,'∞');assert.equal(partial.askingPrice,41861000);assert.equal(partial.style.id,null);assert.equal(partial.style.possibleStyles.length,2);
  const starRow=marketRow('900003');starRow.children[11].childNodes=[text('★★★★☆')];starRow.children[11].children=[];
  const stars=t.parseTransferSearch(marketDoc(1,[starRow]),'https://vfliga.com/transferlist.php').players[0].growth;assert.equal(stars.level,4);assert.equal(stars.maxLevel,5);assert.equal(stars.raw,'★★★★☆');
  const linkRow=marketRow('900004');linkRow.children[2].children.push(node('a','Profile',{href:'player.php?num=900004&ws_token=synthetic-secret'}));
  const linked=t.parseTransferSearch(marketDoc(1,[linkRow]),'https://vfliga.com/transferlist.php').players[0];assert.equal(linked.playerUrl,'https://vfliga.com/player.php?num=900004');assert.equal(JSON.stringify(linked).includes('synthetic-secret'),false);
  const broken=marketRow('900005');broken.children.splice(5,1);assert.equal(t.parseTransferSearch(marketDoc(1,[broken]),'https://vfliga.com/transferlist.php').players.length,0);
  const cap=t.parseTransferSearch(marketDoc(60,Array.from({length:60},(_,i)=>marketRow(String(900010+i)))),'https://vfliga.com/transferlist.php');assert.equal(cap.players.length,50);
  for(const [sort,native] of Object.entries({strength:5,price:7,specials:13,age:3})) {
    assert.equal(t.TRANSFER_SORTS[sort],native);
    for(const total of [0,1,50,51,2527]) {
      const req=[];t.mockMarket([marketDoc(total),marketDoc(total,[marketRow('900002')])],req,form);
      const result=(await t.collectTransferMarket(input,sort)).management.transferMarket.search;
      assert.equal(req.length,total>50?2:1);assert.equal(result.sort.applied,total>50);assert.equal(result.sort.nativeSort,total>50?native:null);
      assert.deepEqual(JSON.parse(JSON.stringify(result.filters.styles)),[{id:4,label:'Тики-така'},{id:5,label:'Катеначчо'}]);assert.equal('style' in result.filters,false);assert.ok(req.every(u=>new URL(u).searchParams.get('day')==='26385'));
      assert.equal(result.filters.age.min,18);assert.equal(result.filters.price.max,10000);assert.equal('rf1' in result.filters,false);
      assert.equal(req.every(u=>new URL(u).pathname==='/transferlist.php'&&new URL(u).searchParams.get('page')==='1'),true);
      assert.equal(req.some(u=>/\/player(?:_stats|_contracts)?\.php/.test(u)),false);
      if(total>50){assert.equal(new URL(req[1]).searchParams.get('sort'),String(native));assert.equal(result.players[0].playerId,'900002');}
      assert.ok(!JSON.stringify(result).includes('ws_token'));
    }
  }
  const invalidReq=[];t.mockMarket([documentWith([])],invalidReq,form);await assert.rejects(t.collectTransferMarket({},'age'),/количество результатов/);assert.equal(invalidReq.length,1);
  const nativeEmpty=documentWith([node('div','Не найдено ни одного игрока на рынке. Попробуйте расширить круг поиска или посмотреть список позже!')]);
  const emptyReq=[];t.mockMarket([nativeEmpty],emptyReq,form);const emptyResult=(await t.collectTransferMarket({},'strength')).management.transferMarket.search;assert.equal(emptyReq.length,1);assert.equal(emptyResult.pagination.totalResults,0);assert.equal(emptyResult.pagination.totalPages,0);assert.equal(emptyResult.pagination.shownFrom,0);assert.equal(emptyResult.players.length,0);assert.equal(emptyResult.sort.applied,false);
  assert.deepEqual(Array.from(emptyResult.filters.styles),[]);assert.equal('style' in emptyResult.filters,false);
  for(const total of [1,51]){const req=[];t.mockMarket([form,marketDoc(total),marketDoc(total)],req);await t.collectTransferMarket({},'strength');assert.equal(req.length,total>50?3:2);assert.equal(req[0],'https://vfliga.com/transferlist.php');assert.ok(req.slice(1).every(u=>new URL(u).searchParams.get('day')==='26385'));assert.ok(req.every(u=>new URL(u).pathname==='/transferlist.php'));}
  const missingReq=[];t.mockMarket([],missingReq,transferForm('завтра, 22:00'));await assert.rejects(t.collectTransferMarket({}),/сегодняшние торги/);assert.equal(missingReq.length,0);
  const bootstrapMissing=[];t.mockMarket([transferForm('завтра, 22:00')],bootstrapMissing);await assert.rejects(t.collectTransferMarket({}),/сегодняшние торги/);assert.equal(bootstrapMissing.length,1);
  const bidHeader=marketHeader();bidHeader.children.splice(1,1);bidHeader.children.pop();bidHeader.children.splice(15,0,node('td','Ст',{title:'Стиль игрока',style:'display:none'}));bidHeader.childNodes=bidHeader.children;
  const bidRow=id=>{const row=marketRow(id);row.children.splice(1,1);row.children.pop();row.children.splice(15,0,node('td','hidden style',{style:'display:none'}));row.childNodes=row.children;return row;};
  const bidPrice=(id,amount,percent)=>tr(['',node('td','Ваша заявка: 000',{},[node('input','',{id:'price_'+id,value:amount}),node('span',percent,{id:'percent_'+id})])]);
  const bidDoc=documentWith([node('select','',{id:'transfer_total'},[node('option','5',{value:'5',selected:''})]),...['GK','LD','CD','RD','LM','CM','RM','LF','CF','RF'].map(key=>node('select','',{id:'transfer_'+key.toLowerCase()},[node('option','1',{value:'1',selected:''})])),node('table','',{},[bidHeader,tr([node('td','Synthetic auction',{title:'День 30',colspan:'5'}),node('td','Synthetic competition',{colspan:'12'})]),bidRow('910001'),bidPrice(0,'11500','41%'),bidRow('910002'),bidPrice(1,'8500','46%'),bidRow('910003'),bidPrice(2,'?','?')])]);
  const bids=t.parseTransferBids(bidDoc,'https://vfliga.com/transferlist.php?status=2&day=-3');assert.equal(bids.bids.length,3);assert.equal(bids.purchaseLimits.total,5);for(const key of ['GK','LD','CD','RD','LM','CM','RM','LF','CF','RF'])assert.equal(bids.purchaseLimits[key],1);
  assert.equal(bids.bids[0].bidPrice,11500000);assert.equal(bids.bids[0].bidPercent,41);assert.equal(bids.bids[1].bidPrice,8500000);assert.equal(bids.bids[0].askingPrice,41861000);assert.equal(bids.bids[0].auction.day,30);assert.equal(bids.bids[0].auction.competition,'Synthetic competition');assert.equal(bids.bids[2].bidPrice,null);assert.equal(bids.bids[2].bidPercent,null);assert.equal('status' in bids.bids[0],false);
  for(const b of bids.bids){assert.equal(b.bidType,'active');assert.equal(b.preliminaryBidPrice,null);assert.equal(b.currentBidPrice,null);assert.equal(b.currentBidPercent,null);}
  const preliminary=(id,previous,current,percent,label='Предв. заявка:')=>tr(['',node('td',label+' 000, актуальная: 000',{},[node('span',previous,{id:'predv_price_'+id}),node('span','актуальная: 000', {id:'td_price_'+id},[node('input','',{id:'price_'+id,value:current}),node('span',percent,{id:'percent_'+id})])])]);
  const typesDoc=documentWith([node('table','',{},[bidHeader,tr([node('td','6 октября, 22:00',{title:'День 41'}),td('Synthetic future auction')]),bidRow('920001'),bidPrice(0,'3500','46%'),bidRow('920002'),preliminary(1,'5 600','5600','68%'),bidRow('920003'),preliminary(2,'?','?','?','Пред. заявка:'),bidRow('920004'),tr(['',td('Предв. заявка: ?, актуальная: ?')]),bidRow('920005')])]);
  const typed=t.parseTransferBids(typesDoc,'https://vfliga.com/transferlist.php?status=2&day=-3').bids;
  assert.equal(typed[0].bidType,'active');assert.equal(typed[0].bidPrice,3500000);assert.equal(typed[0].bidPercent,46);
  assert.equal(typed[1].bidType,'preliminary');assert.equal(typed[1].preliminaryBidPrice,5600000);assert.equal(typed[1].currentBidPrice,5600000);assert.equal(typed[1].currentBidPercent,68);assert.equal(typed[1].bidPrice,null);assert.equal(typed[1].bidPercent,null);
  assert.deepEqual(JSON.parse(JSON.stringify(typed[1].bidRaw)),{preliminaryPrice:'5 600',currentPrice:'5600',currentPercent:'68%'});
  assert.deepEqual(JSON.parse(JSON.stringify(typed[1].auction)),{day:41,date:'6 октября, 22:00',competition:'Synthetic future auction'});
  for(const i of [2,3]){assert.equal(typed[i].bidType,'preliminary');for(const key of ['bidPrice','bidPercent','preliminaryBidPrice','currentBidPrice','currentBidPercent'])assert.equal(typed[i][key],null);}
  const missingPrevious=preliminary(0,'','5600','68%');
  const missingCurrent=preliminary(0,'5 600','','?');
  const onlyPrevious=tr(['',node('td','Предв. заявка: 000',{},[node('span','5 600',{id:'predv_price_0'})])]);
  for(const [row,expected] of [[missingPrevious,[null,5600000,68]],[missingCurrent,[5600000,null,null]],[onlyPrevious,[5600000,null,null]]]){
    const b=t.parseTransferBids(documentWith([node('table','',{},[bidHeader,bidRow('920010'),row])]),'https://vfliga.com/transferlist.php?status=2').bids[0];
    assert.equal(b.preliminaryBidPrice,expected[0]);assert.equal(b.currentBidPrice,expected[1]);assert.equal(b.currentBidPercent,expected[2]);assert.equal(b.bidPrice,null);assert.equal(b.bidPercent,null);
  }
  assert.equal(typed[4].bidType,null);assert.equal(typed[4].currentBidPrice,null);
  const bidsReq=[];t.mockMarket([bidDoc],bidsReq);const bidsExport=await t.collectTransferBids();assert.equal(bidsReq.length,1);assert.equal(new URL(bidsReq[0]).searchParams.get('status'),'2');assert.equal(bidsExport.management.transferMarket.myBids.bids.length,3);assert.equal('search' in bidsExport.management.transferMarket,false);
  assert.equal(t.parseTransferBids(documentWith([]),'https://vfliga.com').purchaseLimits.GK,null);
  assert.equal(/change_transfer_pos|method\s*:\s*["']POST|DelMyTransferRequest|EditMyTransferRequest/.test(source),false);
  console.log('PASS: active/preliminary bids and future auctions; own Normal/Deep all-tournament rosterSeasonStats independent of selectedStats, reuse of single sort=300 request; today trade day and safe errors/form reuse/bootstrap, readable native positions, multi-style filters/export/UI, transfer filters/defaults/6 styles/17 positions, 4 live native sorts, one-page 1 request, multi-page 2 requests, first 50 only, 0 player requests, market/bid layouts, unknown/raw values and safe links, read-only bid limits/prices; all existing Management, own/opponent deep, clubData, current-season, roster and security regressions.');
}).catch(error=>{console.error(error);process.exitCode=1;});
