// Synthetic fixtures only; no user session exports.
// Run with: node regression.test.cjs. No dependencies or network requests.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(__dirname + '/content.js', 'utf8');
const exposed = source.slice(0, source.indexOf('  const panel =')) + '\n window.test = {extractJPlayers,parsePlayerInfo,parsePlayerStats,parsePlayerContract,mergePlayerDetails,domText,collectLinks};})();';
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
        if(s==='td'||s==='th') return c.tagName===s.toUpperCase();
        if(s==='[title]')return 'title' in c.attrs;
        if(s==='option:checked')return c.tagName==='OPTION'&&c.selected;
        if(s==='option[selected]')return c.tagName==='OPTION'&&'selected' in c.attrs;
        if(s==='select[name="season"]')return c.tagName==='SELECT'&&c.attrs.name==='season';
        if(s==='select option')return c.tagName==='OPTION';
        if(s==='body')return c.tagName==='BODY';
        if(s==='a[href]')return c.tagName==='A'&&c.attrs.href;
        if(s.startsWith('tr[data-role='))return c.tagName==='TR'&&c.attrs['data-role']===s.match(/"([^"]+)"/)[1];
        return false;
      }));
    },cloneNode(){return this;},remove(){} };
  Object.defineProperty(n,'descendants',{get:()=>n.children.flatMap(c=>[c,...(c.descendants||[])])});
  Object.defineProperty(n,'textContent',{get:()=>n.childNodes.map(c=>c.nodeType===3?c.nodeValue:c.textContent).join('')});
  n.children.forEach((c,i)=>{c.nextElementSibling=n.children[i+1]||null;});
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
assert.equal(p.stats.averageRating,6.5);assert.equal(p.stats.games,4);assert.equal(p.stats.goals,2);assert.equal(p.stats.assists,1);assert.equal(p.stats.yellowCards,0);assert.equal(p.stats.scope.sort,300);
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
assert.equal(merged.fatigue,11);assert.equal(merged.realStrength,89);assert.equal(merged.stats.seasonMinutes,300);assert.equal(merged.rosterStats.games,4);
const contractDoc=documentWith([node('div','Действующий контракт'),node('table','',{},[field('Команда:','Example FC'),field('Менеджер, заключивший контракт:','Example Manager'),field('Сезон подписания контракта:','60'),field('Срок:','до конца 62-го сезона'),field('Зарплата:','12 000')]),node('div','в контракте на 3 следующих сезона (до конца 63-го сезона) игрока точно устроит зарплата 14 000 за тур')]);
const contract=t.parsePlayerContract(contractDoc,'contracts','123456');
assert.equal(contract.team,'Example FC');assert.equal(contract.signedSeason,60);assert.equal(contract.salary,12000);assert.equal(contract.acceptableSalaryNextSeason,null);assert.equal(contract.acceptableSalaryProposal.salaryPerTour,14000);assert.equal(contract.acceptableSalaryProposal.followingSeasons,3);
assert.equal(t.domText(node('div','secret',{style:'display:none'})),'');
const links=t.collectLinks(documentWith([node('a','Статистика',{href:'player_stats.php?num=123456'})]),'https://vfliga.com/player.php?num=123456');
assert.equal(links[0].text,'Статистика');
console.log('PASS: synthetic jPlayer mapping, hidden values, profile fields, selected season, stats totals, contracts, merge, detached DOM text and links.');
