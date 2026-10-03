// Synthetic fixtures only; no user session exports.
// Run with: node regression.test.cjs. No dependencies or network requests.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(__dirname + '/content.js', 'utf8');
const exposed = source.slice(0, source.indexOf('  const panel =')) + '\n window.test = {extractJPlayers,parsePlayerInfo,parsePlayerStats,parsePlayerContract,mergePlayerDetails,domText,collectLinks,rosterCompact,playerIds,parseManagerCore,deepPlayerScan,collectOwnTeam,collectOpponent,pickMatches,safeBodyText, mockCollectors: (display,current,opponent,profile) => { document=display; setStatus=()=>{}; nearestOpponentRosterUrl=()=>ORIGIN+"/roster.php?num=12345"; fetchDoc=async url=>url.includes("player.php")?profile:url.includes("sort=300")?current:url.includes("roster.php")?opponent:display; fetchMatches=async()=>[]; }, mockDeep: (fixture,requests) => { setStatus = () => {}; fetchDoc = async url => { requests.push(url); return fixture; }; }};})();';
const context = {window:{}, location:{origin:'https://vfliga.com',href:'https://vfliga.com/managerzone.php',pathname:'/managerzone.php'}, URL, Map, Set};
vm.runInNewContext(exposed, context);
const t = context.window.test;
function text(value) { return {nodeType:3,nodeValue:String(value)}; }
function node(tag, value='', attrs={}, children=[]) {
  const n = {nodeType:1,tagName:tag.toUpperCase(),attrs,children,childNodes: value ? [text(value),...children] : children,
    getAttribute(k) {return this.attrs[k] ?? null;},
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
assert.equal(merged.fatigue,11);assert.equal(merged.realStrength,89);assert.equal(merged.stats.seasonMinutes,300);assert.equal(merged.selectedStats.games,4);
const contractDoc=documentWith([node('div','Действующий контракт'),node('table','',{},[field('Команда:','Example FC'),field('Менеджер, заключивший контракт:','Example Manager'),field('Сезон подписания контракта:','60'),field('Срок:','до конца 62-го сезона'),field('Зарплата:','12 000')]),node('div','в контракте на 3 следующих сезона (до конца 63-го сезона) игрока точно устроит зарплата 14 000 за тур')]);
const contract=t.parsePlayerContract(contractDoc,'contracts','123456');
assert.equal(contract.team,'Example FC');assert.equal(contract.signedSeason,60);assert.equal(contract.salary,12000);assert.equal(contract.acceptableSalaryNextSeason,null);assert.equal(contract.acceptableSalaryProposal.salaryPerTour,14000);assert.equal(contract.acceptableSalaryProposal.followingSeasons,3);
assert.equal(t.domText(node('div','secret',{style:'display:none'})),'');
const links=t.collectLinks(documentWith([node('a','Статистика',{href:'player_stats.php?num=123456'})]),'https://vfliga.com/player.php?num=123456');
assert.equal(links[0].text,'Статистика');
// One incidental direct link must not truncate the authoritative jPlayer roster.
const many = Array.from({length:24},(_,i)=>{const a=[...args];a[0]=200000+i;return 'new jPlayer('+a.map(JSON.stringify).join(',')+')';});
const opponentDoc=documentWith([node('a','Player',{href:'player.php?num=200000'})],many.join(';')+';'+many[0]);
const roster=t.rosterCompact(opponentDoc,'12345');
assert.equal(roster.players.length,24);
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
const scout=t.parseManagerCore(documentWith([node('div','Есть 8 изучений стилей, 7 роста силы, 6 падения силы, 0 травматичности, 4 лояльности')])).resources.scout;
assert.deepEqual(JSON.parse(JSON.stringify(scout)),{styles:8,growth:7,decline:6,injury:0,loyalty:4});
assert.equal(t.parseManagerCore(documentWith([])).resources.scout.styles,null);
assert.equal(t.parseManagerCore(documentWith([node('div','Осталось 2 изучения стилей')])).resources.scout.styles,2);
const cup=statsRow('mt',['','Synthetic Cup','-','2','-','?','-','-','-','-','-'],{'data-mt':'2','data-group':'club'});
const counter=node('div','3',{class:'txt2',style:'float:right'});
counter.parent=cup.children[1];cup.children[1].children.push(counter);cup.children[1].childNodes.push(counter);
const cleanStats=t.parsePlayerStats(documentWith([node('table','',{},[cup,total,statsRow('team',['','Not a tournament','8','100'])])]),'stats','123456');
assert.equal(cleanStats.tournaments.length,1);assert.equal(cleanStats.tournaments[0].tournament,'Synthetic Cup');
assert.equal(cleanStats.tournaments[0].averageRating,null);assert.equal(cleanStats.tournaments[0].goals,0);assert.equal(cleanStats.tournaments[0].assists,null);
assert.equal(cleanStats.total.games,5); // never recomputed from tournaments
// Exercise the actual deep loop over every roster ID, without network or delays.
context.setTimeout=fn=>fn();
context.document=doc;
context.window.requests=[];t.mockDeep(infoDoc,context.window.requests);
t.deepPlayerScan(roster,'Synthetic opponent',id=>'https://vfliga.com/player.php?num='+id).then(async details=>{
  assert.equal(details.length,24);assert.equal(context.window.requests.length,24);
  assert.deepEqual(Array.from(details,p=>p.playerId),Array.from(roster.playerIds));
  const ownDisplay=documentWith([],playerLine+';var curr=12345;var sort=1;');
  const ownCurrent=documentWith([],playerLine+';var curr=12345;var sort=300;');
  t.mockCollectors(ownDisplay,ownCurrent,opponentDoc,infoDoc);
  for(const depth of ['normal','deep']) {
    const own=await t.collectOwnTeam(1,depth);
    assert.equal(own.roster.players.length,1);assert.equal(own.roster.players[0].fatigue,11);
    assert.equal(own.roster.players[0].selectedStats.scope.sort,1);
    if(depth==='deep')assert.equal(own.playerDetails[0].selectedStats.scope.sort,1);
    const opponent=await t.collectOpponent(1,depth);
    assert.equal(opponent.roster.playerIds.length,24);
    if(depth==='deep')assert.equal(opponent.playerDetails.length,24);
  }
  const matches=t.pickMatches(documentWith([node('a','played',{href:'viewmatch.php?day=10'}),node('a','preview',{href:'previewmatch.php?day=11'})]),'https://vfliga.com',10);
  assert.equal(matches.length,1);assert.ok(matches[0].url.includes('/viewmatch.php?'));
  assert.equal(t.safeBodyText(documentWith([node('script','ws_token=synthetic-secret'),node('div','synthetic-chat',{id:'chat_txt'}),node('div','safe')])), 'safe');
  console.log('PASS: synthetic roster IDs and full deep loop, selectedStats separation, scout counters, tournament cleanup, unknown values, profile, season, totals, contracts and links.');
}).catch(error=>{console.error(error);process.exitCode=1;});
