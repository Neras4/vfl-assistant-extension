
(() => {
  if (window.__VFL_ASSISTANT_V05__) return;
  window.__VFL_ASSISTANT_V05__ = true;

  const VERSION = "0.5.6";
  const ORIGIN = location.origin;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function clean(s) {
    return (s || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function absUrl(href, base = location.href) {
    try { return new URL(href, base).href; } catch { return null; }
  }

  function param(url, name) {
    try { return new URL(url).searchParams.get(name); } catch { return null; }
  }

  function uniq(arr, keyFn = x => x) {
    const seen = new Set();
    return arr.filter(x => {
      const key = keyFn(x);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function sanitizedRoot(doc) {
    const clone = doc.documentElement.cloneNode(true);
    clone.querySelectorAll("script,style,noscript,#chat_txt,#chat_btn,.chatDM,#vfl-assistant-panel").forEach(n => n.remove());
    return clone;
  }

  function safeBodyText(doc, limit = 12000) {
    const clone = sanitizedRoot(doc);
    const text = clean(domText(clone.querySelector("body")));
    return text.slice(0, limit);
  }

  // DOMParser documents and detached clones have no layout: innerText is not
  // reliable there. Preserve cell/block boundaries and only the selected option.
  function domText(node) {
    if (!node) return "";
    if (node.nodeType === 3) return node.nodeValue || "";
    if (node.nodeType !== 1) return "";
    if (node.matches('script,style,noscript,[hidden],[style*="display:none"],[style*="display: none"]')) return "";
    if (node.tagName === "SELECT") return node.querySelector('option:checked,option[selected]')?.textContent || "";
    if (node.tagName === "BR") return "\n";
    const text = [...node.childNodes].map(domText).join("");
    return /^(DIV|P|TR|TABLE|H[1-6]|LI|SECTION)$/.test(node.tagName) ? `\n${text}\n` : /^(TD|TH)$/.test(node.tagName) ? `${text}\t` : text;
  }

  function cellValue(doc, label) {
    const cell = [...doc.querySelectorAll("td,th")].find(c => clean(domText(c)).replace(/:$/, "") === label);
    return cell?.nextElementSibling || null;
  }

  function cellNumber(doc, label) {
    const raw = clean(domText(cellValue(doc, label))).replace(/[%\s]/g, "").replace(",", ".");
    return /^\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : null;
  }

  function safeTableRows(doc) {
    const clone = sanitizedRoot(doc);
    return [...clone.querySelectorAll("table")].map((t, index) => ({
      index,
      rows: [...t.querySelectorAll("tr")]
        .map(tr => [...tr.children].filter(td => /^(TD|TH)$/.test(td.tagName)).map(td => clean(domText(td))))
        .filter(row => row.some(Boolean))
    })).filter(t => t.rows.length);
  }

  function collectLinks(doc, base) {
    const clone = sanitizedRoot(doc);
    return uniq(
      [...clone.querySelectorAll("a[href]")]
        .map(a => ({ text: clean(domText(a)), href: absUrl(a.getAttribute("href"), base) }))
        .filter(x => x.href && x.href.startsWith(ORIGIN)),
      x => x.href
    );
  }

  async function fetchDoc(url) {
    const res = await fetch(url, {
      credentials: "include",
      cache: "no-store",
      redirect: "follow",
      headers: {"Accept": "text/html,application/xhtml+xml"}
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
    return new DOMParser().parseFromString(text, "text/html");
  }

  function teamIdFromManager(doc = document) {
    const html = doc.documentElement.innerHTML;
    const fromVar = html.match(/\bcurr\s*=\s*(\d+)/)?.[1];
    if (fromVar) return fromVar;

    const pic = doc.querySelector('a[href*="loadpicture.php?c="]');
    if (pic) {
      const id = param(absUrl(pic.getAttribute("href")), "c");
      if (id) return id;
    }

    for (const a of doc.querySelectorAll('a[href*="managerzone.php?num="]')) {
      const id = param(absUrl(a.getAttribute("href")), "num");
      if (id) return id;
    }
    return null;
  }

  function parseRatings(text) {
    function n(rx) {
      const m = text.match(rx);
      return m ? Number(m[1]) : null;
    }
    return {
      vs: n(/Рейтинг силы команды \(Vs\):\s*([+-]?\d+)/i),
      s11: n(/Сила 11-ти лучших \(s11\):\s*([+-]?\d+)/i),
      s14: n(/Сила 14-ти лучших \(s14\):\s*([+-]?\d+)/i),
      s17: n(/Сила 17-ти лучших \(s17\):\s*([+-]?\d+)/i)
    };
  }

  function parseManagerCore(doc) {
    const text = safeBodyText(doc, 20000);
    const financeRaw = text.match(/Финансы:\s*([\d\s]+)/i)?.[1];
    const name = [...doc.querySelectorAll(".tmhd")].map(x => clean(domText(x))).find(Boolean) || null;

    return {
      teamName: name,
      finance: financeRaw ? Number(financeRaw.replace(/\s/g, "")) : null,
      stadium: text.match(/Стадион:\s*([^\n]+)/i)?.[1] || null,
      base: text.match(/База:\s*([^\n]+)/i)?.[1] || null,
      atmosphere: Number(text.match(/Атмосфера в команде:\s*([+-]?\d+)%/i)?.[1] || 0) || null,
      ratings: parseRatings(text)
    };
  }

  function parseRosterCore(doc) {
    const text = safeBodyText(doc, 16000);
    const financeRaw = text.match(/Финансы:\s*([\d\s]+)/i)?.[1];
    const name = clean(domText(doc.querySelector(".tmhd"))) || null;
    return {
      teamName: name,
      finance: financeRaw ? Number(financeRaw.replace(/\s/g, "")) : null,
      stadium: text.match(/Стадион:\s*([^\n]+)/i)?.[1] || null,
      base: text.match(/База:\s*([^\n]+)/i)?.[1] || null,
      atmosphere: Number(text.match(/Атмосфера в команде:\s*([+-]?\d+)%/i)?.[1] || 0) || null,
      ratings: parseRatings(text)
    };
  }

  function findPlayerTable(doc) {
    const tables = [...sanitizedRoot(doc).querySelectorAll("table")];
    return tables.find(t => {
      const txt = clean(domText(t.rows?.[0]));
      return /Игрок/.test(txt) && /Поз/.test(txt) && /Спецвозможности/.test(txt);
    }) || null;
  }

  function parseJsArg(token) {
    const t = (token || "").trim();
    if (!t) return "";
    if (t.startsWith('"') && t.endsWith('"')) {
      try { return JSON.parse(t); } catch { return t.slice(1, -1); }
    }
    if (/^-?\d+(?:\.\d+)?$/.test(t)) return Number(t);
    return t;
  }

  function splitJsArgs(s) {
    const out = [];
    let buf = "";
    let quote = null;
    let escape = false;

    for (let i = 0; i < s.length; i++) {
      const ch = s[i];

      if (escape) {
        buf += ch;
        escape = false;
        continue;
      }
      if (ch === "\\") {
        buf += ch;
        escape = true;
        continue;
      }
      if (quote) {
        buf += ch;
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        buf += ch;
        continue;
      }
      if (ch === ",") {
        out.push(parseJsArg(buf));
        buf = "";
        continue;
      }
      buf += ch;
    }
    out.push(parseJsArg(buf));
    return out;
  }

  function extractJPlayers(doc, expectedTeamId = null) {
    const html = doc.documentElement.innerHTML || "";
    const marker = "new jPlayer(";
    const players = [];
    let pos = 0;

    while (true) {
      const start = html.indexOf(marker, pos);
      if (start < 0) break;

      let i = start + marker.length;
      let quote = null;
      let escape = false;
      let depth = 1;

      for (; i < html.length; i++) {
        const ch = html[i];

        if (escape) {
          escape = false;
          continue;
        }
        if (ch === "\\") {
          escape = true;
          continue;
        }
        if (quote) {
          if (ch === quote) quote = null;
          continue;
        }
        if (ch === '"' || ch === "'") {
          quote = ch;
          continue;
        }
        if (ch === "(") depth++;
        if (ch === ")") {
          depth--;
          if (depth === 0) break;
        }
      }

      if (i >= html.length) break;

      const args = splitJsArgs(html.slice(start + marker.length, i));
      pos = i + 1;

      const id = String(args[0] ?? "");
      const teamId = String(args[1] ?? "");
      if (!/^\d+$/.test(id)) continue;
      if (expectedTeamId && teamId !== String(expectedTeamId)) continue;

      const first = clean(String(args[2] ?? ""));
      const last = clean(String(args[3] ?? ""));
      const name = clean([first, last].filter(Boolean).join(" "));

      players.push({
        id,
        teamId,
        name: name || null,
        country: args[5] || null,
        position: [args[6], args[7]].filter(Boolean).join("/") || null,
        age: Number.isFinite(Number(args[9])) ? Number(args[9]) : null,
        strength: Number.isFinite(Number(args[10])) ? Number(args[10]) : null,
        fatigue: Number(args[12]) >= 0 && Number(args[13]) > 0 ? Number(args[12]) : null,
        form: Number(args[13]) > 0 ? Number(args[13]) : null,
        formTrend: Number(args[13]) > 0 ? ({1: "rising", 2: "falling"}[args[14]] || null) : null,
        realStrength: Number.isFinite(Number(args[15])) ? Number(args[15]) : null,
        specials: [args[16], args[17], args[18], args[19]].filter(Boolean).map(String),
        selectedStats: Number(args[52]) >= 0 && args.length > 57 ? {
          scope: rosterScope(doc),
          averageRating: Number(args[57]), games: Number(args[52]),
          goals: Number(args[53]), assists: Number(args[54]),
          yellowCards: Number(args[55]), redCards: Number(args[56])
        } : null
      });
    }

    return uniq(players, p => p.id);
  }

  function playerIds(doc, expectedTeamId = null) {
    const fromLinks = uniq(
      [...doc.querySelectorAll('a[href*="player.php?num="]')]
        .map(a => param(absUrl(a.getAttribute("href")), "num"))
        .filter(Boolean)
    );
    const players = extractJPlayers(doc, expectedTeamId);
    return players.length ? uniq(players.map(p => p.id).filter(Boolean)) : fromLinks;
  }

  function rosterCompact(doc, expectedTeamId = null) {
    const scriptPlayers = extractJPlayers(doc, expectedTeamId);
    const ids = scriptPlayers.length ? uniq(scriptPlayers.map(p => p.id).filter(Boolean)) : playerIds(doc, expectedTeamId);
    const table = findPlayerTable(doc);

    if (!table) {
      return {
        playerIds: ids,
        players: scriptPlayers,
        rows: []
      };
    }

    const rows = [...table.querySelectorAll("tr")]
      .filter(tr => tr.closest("table") === table)
      .map(tr => [...tr.children].filter(td => /^(TD|TH)$/.test(td.tagName)).map(td => clean(domText(td))))
      .filter(row => row.some(Boolean));

    const compact = rows.filter(row => {
      const joined = row.join(" | ");
      return joined.length < 700 && (
        /Игрок/.test(joined) ||
        /\b(GK|LD|CD|RD|LM|CM|RM|LF|CF|RF)(\/(?:GK|LD|CD|RD|LM|CM|RM|LF|CF|RF))?\b/.test(joined)
      );
    });

    return {
      playerIds: ids,
      players: scriptPlayers,
      rows: compact.slice(0, 80)
    };
  }

  function rosterScope(doc) {
    const option = [...doc.querySelectorAll("select option")].find(o => /sort=/.test(o.getAttribute("value") || "") && o.selected);
    const sort = option ? param(absUrl(option.getAttribute("value")), "sort") : doc.documentElement.innerHTML.match(/\bvar sort\s*=\s*(-?\d+)/)?.[1];
    const season = doc.querySelector('select[name="season"] option:checked')?.getAttribute('value') || doc.documentElement.innerHTML.match(/\bvar tek_season\s*=\s*(\d+)/)?.[1];
    return { sort: sort == null ? null : Number(sort), label: option ? clean(domText(option)) : null, season: season == null ? null : Number(season) };
  }

  function matchHistoryUrlForManager(doc, teamId) {
    const links = collectLinks(doc, location.href);
    const found = links.find(l =>
      /managerzone\.php/.test(l.href) &&
      param(l.href, "pm") === "2" &&
      (!teamId || param(l.href, "num") === teamId)
    );
    return found?.href || `${ORIGIN}/managerzone.php?num=${encodeURIComponent(teamId)}&pm=2`;
  }

  function matchHistoryUrlForRoster(doc, teamId, rosterUrl) {
    const links = collectLinks(doc, rosterUrl);
    const found = links.find(l =>
      /roster_m\.php/.test(l.href) &&
      (!teamId || param(l.href, "num") === teamId)
    );
    return found?.href || `${ORIGIN}/roster_m.php?num=${encodeURIComponent(teamId)}`;
  }

  function pickMatches(doc, baseUrl, maxMatches) {
    const matches = uniq(
      collectLinks(doc, baseUrl).filter(l => {
        try {
          return new URL(l.href).pathname === "/viewmatch.php";
        } catch {
          return false;
        }
      }),
      l => l.href
    ).map(l => ({
      url: l.href,
      day: Number(param(l.href, "day") || 0),
      matchId: param(l.href, "match_id")
    }));

    matches.sort((a, b) => b.day - a.day);
    return matches.slice(0, maxMatches);
  }

  function matchCompact(doc, url) {
    const text = safeBodyText(doc, 14000);
    // Strip obvious site chrome while retaining match/tactics detail.
    const start = Math.max(0, text.search(/Сравнение соперников|Матч|Прогноз погоды|Сезон \d+/i));
    const useful = start > 0 ? text.slice(start) : text;
    return {
      url,
      day: Number(param(url, "day") || 0),
      matchId: param(url, "match_id"),
      text: useful.slice(0, 12000)
    };
  }

  async function fetchMatches(links, label) {
    const out = [];
    for (let i = 0; i < links.length; i++) {
      setStatus(`${label}: ${i + 1}/${links.length}`);
      try {
        const doc = await fetchDoc(links[i].url);
        out.push(matchCompact(doc, links[i].url));
      } catch (e) {
        out.push({ url: links[i].url, error: String(e) });
      }
      await sleep(100);
    }
    return out;
  }

  function nearestOpponentRosterUrl(doc) {
    // A future fixture has an order link; played fixtures have viewmatch links.
    for (const order of doc.querySelectorAll('a[href*="mng_order.php"]')) {
      const fixture = order.parentElement;
      const opponent = fixture?.querySelector('a[href*="roster.php?num="]');
      if (opponent) return absUrl(opponent.getAttribute('href'), location.href);
    }
    const hrs = [...doc.querySelectorAll("div.hr")];
    for (const hr of hrs) {
      let node = hr.nextElementSibling;
      while (node) {
        const a = node.matches?.('a[href*="roster.php?num="]')
          ? node
          : node.querySelector?.('a[href*="roster.php?num="]');
        if (a) return absUrl(a.getAttribute("href"), location.href);
        if (node.matches?.("div.hr")) break;
        node = node.nextElementSibling;
      }
    }

    try {
      const xp1 = `(//table[@class='wst nil']//div[@class='hr']/following-sibling::div/a)[1]`;
      const node = document.evaluate(xp1, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      if (node?.getAttribute) return absUrl(node.getAttribute("href"), location.href);
    } catch {}

    try {
      const xp2 = `/html/body/table/tbody/tr[4]/td/div/table[2]/tbody/tr/td[2]/div[6]/a`;
      const node = document.evaluate(xp2, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      if (node?.getAttribute) return absUrl(node.getAttribute("href"), location.href);
    } catch {}

    return null;
  }

  function detectPlayerTabLinks(doc, playerId, baseUrl) {
    const links = collectLinks(doc, baseUrl).filter(l => param(l.href, "num") === String(playerId));
    const out = { stats: null, contract: null };

    for (const l of links) {
      const t = (l.text || "").toLowerCase();
      const p = new URL(l.href).pathname.toLowerCase();
      if (!out.contract && (t.includes("контракт") || p.includes("contract"))) out.contract = l.href;
      if (!out.stats && (t.includes("статист") || p.includes("stat"))) out.stats = l.href;
    }
    return out;
  }

  function textNumber(text, rx) {
    const m = text.match(rx);
    if (!m) return null;
    const raw = String(m[1]).replace(/\s+/g, "").replace(",", ".");
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function textValue(text, rx) {
    const m = text.match(rx);
    return m ? clean(m[1]) : null;
  }

  function rosterPlayerMap(roster) {
    return new Map((roster?.players || []).map(p => [String(p.id), p]));
  }

  function parsePlayerInfo(doc, url, playerId) {
    const text = safeBodyText(doc, 18000);

    const usefulness = (() => {
      const m = domText(cellValue(doc, "Полезность в этом сезоне")).match(/(\d+)%\s*=\s*([\d\s]+)\s*из\s*([\d\s]+)\s*минут/i);
      if (!m) return null;
      return {
        percent: Number(m[1]),
        minutes: Number(m[2].replace(/\s/g, "")),
        targetMinutes: Number(m[3].replace(/\s/g, ""))
      };
    })();

    const gamePractice = (() => {
      return clean(domText(cellValue(doc, "Игровая практика"))) || null;
    })();

    // Style is tricky because an unknown style is rendered as an empty block.
    // Accept only a short standalone value and explicitly reject labels from the next section.
    const styleCell = cellValue(doc, "Стиль");
    let style = styleCell?.querySelector('[title]')?.getAttribute('title') || clean(domText(styleCell)) || null;
    if (style && /^(Контракт|Играл подряд|Лояльность|Травматичность|Зарплата|Стоимость)/i.test(style)) {
      style = null;
    }

    let contractUntil = null;
    const cm = text.match(/Контракт с [^\n]+ до ([^\n]+)/i);
    if (cm) contractUntil = clean(cm[1]);

    // Salary/value: capture only a single displayed number, not concatenated explanatory text.
    const salaryPerTour = cellNumber(doc, "Зарплата за тур");
    const value = cellNumber(doc, "Стоимость");
    const formCell = cellValue(doc, "Форма на сегодня");
    const formTitle = formCell?.getAttribute('title') || formCell?.querySelector('[title]')?.getAttribute('title') || "";

    return {
      playerId: String(playerId),
      url,
      fatigue: cellNumber(doc, "Усталость"),
      form: textNumber(formTitle, /(\d+)%/),
      formTrend: /раст[её]т/i.test(formTitle) ? "rising" : /падает/i.test(formTitle) ? "falling" : null,
      realStrength: cellNumber(doc, "Реальная сила"),
      role: clean(domText(cellValue(doc, "Роль в команде"))) || null,
      usefulness,
      gamePractice,
      style,
      loyalty: cellNumber(doc, "Лояльность"),
      injuryRisk: cellNumber(doc, "Травматичность"),
      salaryPerTour,
      value,
      contractUntil,
      playedInRow: textNumber(domText(cellValue(doc, "Играл подряд")), /(\d+)\s*матч/i),
      seasonMinutes: textNumber(text, /В соревновательных матчах сезона сыграл:\s*([\d ]+)\s*мин/i)
    };
  }

  function parsePlayerStats(doc, url, playerId) {
    const select = doc.querySelector('select[name="season"]');
    const selected = select?.querySelector('option:checked,option[selected]');
    const season = selected ? Number(selected.getAttribute('value')) : null;
    function rowStats(row) {
      if (!row) return null;
      const cells = [...row.children];
      const n = i => {
        const raw = clean(domText(cells[i])).replace(/\s/g, "").replace(",", ".");
        return raw === "-" && i !== 2 ? 0 : /^\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : null;
      };
      return { averageRating: n(2), games: n(3), goals: n(4), assists: n(5),
        yellowCards: n(8), redCards: n(9) };
    }
    const total = rowStats(doc.querySelector('tr[data-role="total"]'));
    function tournamentName(cell) {
      const label = cell.cloneNode(true);
      // VFL adds a floating promotion/card counter beside the tournament title.
      label.querySelectorAll('div.txt2').forEach(n => {
        if (/float\s*:\s*right/i.test(n.getAttribute('style') || '') && /^\d+$/.test(clean(domText(n)))) n.remove();
      });
      return clean(domText(label));
    }
    const tournaments = [...doc.querySelectorAll('tr[data-role="mt"]')].map(row => ({
      tournament: tournamentName(row.children[1]), tournamentId: row.getAttribute('data-mt'),
      group: row.getAttribute('data-group'), ...rowStats(row)
    }));
    return {
      playerId: String(playerId),
      url,
      season,
      seasonMinutes: null,
      totalRating: total?.averageRating ?? null,
      total,
      tournaments
    };
  }

  function parsePlayerContract(doc, url, playerId) {
    const text = safeBodyText(doc, 18000);
    const proposalText = text.match(/в контракте на [\s\S]*?точно устроит зарплата\s*[\d ]+\s*за тур/i)?.[0] || "";
    const proposalSalary = textNumber(proposalText, /точно устроит зарплата\s*([\d ]+)\s*за тур/i);
    const proposalSeasons = textNumber(proposalText, /в контракте на\s*(\d+)\s*следующ/i);

    return {
      playerId: String(playerId),
      url,
      team: textValue(text, /Действующий контракт[\s\S]*?Команда:\s*([^\n\t]+)/i),
      manager: clean(domText(cellValue(doc, "Менеджер, заключивший контракт"))) || null,
      signedSeason: cellNumber(doc, "Сезон подписания контракта"),
      term: clean(domText(cellValue(doc, "Срок"))) || null,
      salary: cellNumber(doc, "Зарплата"),
      acceptableSalaryNextSeason: proposalSeasons === 1 ? proposalSalary : null,
      acceptableSalaryProposal: proposalSalary == null ? null : { salaryPerTour: proposalSalary, followingSeasons: proposalSeasons }
    };
  }

  function mergePlayerDetails(rosterPlayer, info, stats, contract) {
    return {
      playerId: String(rosterPlayer?.id || info?.playerId || stats?.playerId || contract?.playerId || ""),
      name: rosterPlayer?.name ?? null,
      country: rosterPlayer?.country ?? null,
      position: rosterPlayer?.position ?? null,
      age: rosterPlayer?.age ?? null,
      strength: rosterPlayer?.strength ?? null,
      fatigue: info?.fatigue ?? rosterPlayer?.fatigue ?? null,
      form: info?.form ?? rosterPlayer?.form ?? null,
      formTrend: info?.formTrend ?? rosterPlayer?.formTrend ?? null,
      realStrength: info?.realStrength ?? rosterPlayer?.realStrength ?? null,
      specials: rosterPlayer?.specials ?? [],
      selectedStats: rosterPlayer?.selectedStats ?? null,
      info: info || null,
      stats: stats ? { ...stats, seasonMinutes: info?.seasonMinutes ?? null } : null,
      contract: contract || null
    };
  }

  async function deepPlayerScan(roster, progressLabel, baseUrlBuilder) {
    const ids = roster?.playerIds || [];
    const rmap = rosterPlayerMap(roster);
    const out = [];

    for (let i = 0; i < ids.length; i++) {
      const id = String(ids[i]);
      setStatus(`${progressLabel}: ${i + 1}/${ids.length}`);

      let info = null;
      let stats = null;
      let contract = null;

      try {
        const url = baseUrlBuilder(id);
        const infoDoc = await fetchDoc(url);
        info = parsePlayerInfo(infoDoc, url, id);

        const tabs = detectPlayerTabLinks(infoDoc, id, url);

        if (tabs.stats && tabs.stats !== url) {
          try {
            const d = await fetchDoc(tabs.stats);
            stats = parsePlayerStats(d, tabs.stats, id);
          } catch (e) {
            stats = { playerId: id, url: tabs.stats, error: String(e) };
          }
          await sleep(80);
        }

        if (tabs.contract && tabs.contract !== url) {
          try {
            const d = await fetchDoc(tabs.contract);
            contract = parsePlayerContract(d, tabs.contract, id);
          } catch (e) {
            contract = { playerId: id, url: tabs.contract, error: String(e) };
          }
          await sleep(80);
        }
      } catch (e) {
        info = { playerId: id, error: String(e) };
      }

      out.push(mergePlayerDetails(rmap.get(id), info, stats, contract));
      await sleep(120);
    }

    return out;
  }

  function clubNumber(raw) {
    const value = clean(raw).replace(/\s/g, '').replace(',', '.');
    const match = value.match(/^([+-]?\d+(?:\.\d+)?)(к|м|%|затур)?$/i);
    if (!match) return null;
    const scale = { 'к': 1000, 'м': 1000000 }[match[2]?.toLowerCase()] || 1;
    const number = Number(match[1]) * scale;
    return Number.isFinite(number) ? number : null;
  }

  function clubSeason(doc) {
    const option = doc.querySelector('select[name="season"]')?.querySelector('option:checked,option[selected]');
    return option ? clubNumber(option.getAttribute('value')) : null;
  }

  function directTableRows(table) {
    return [...table.querySelectorAll('tr')].filter(row => row.closest('table') === table);
  }

  function parseClubFinances(doc, sourceUrl) {
    const entries = [];
    for (const table of sanitizedRoot(doc).querySelectorAll('table')) {
      const rows = directTableRows(table);
      if (!rows.some(row => {
        const c = [...row.children].map(n => clean(domText(n)));
        return c.length === 5 && c[0] === 'День' && c[1] === 'Было' && c[2] === '+/-' && c[3] === 'Стало';
      })) continue;
      for (const row of rows) {
        const c = [...row.children];
        if (c.length !== 6 || !/^dh\d+$/.test(c[1].getAttribute('title') || '')) continue;
        const change = clubNumber(domText(c[3]));
        entries.push({
          date: clean(domText(c[1])) || null,
          description: clean(domText(c[5])) || null,
          balanceBefore: clubNumber(domText(c[2])),
          income: change !== null && change >= 0 ? change : null,
          expense: change !== null && change < 0 ? -change : null,
          balanceAfter: clubNumber(domText(c[4]))
        });
      }
    }
    return { sourceUrl, collectedAt: new Date().toISOString(), season: clubSeason(doc),
      entries: uniq(entries, entry => JSON.stringify(entry)) };
  }

  function parseClubDeals(doc, sourceUrl) {
    const transactions = [];
    const seen = new Set();
    const season = clubSeason(doc);
    for (const table of sanitizedRoot(doc).querySelectorAll('table')) {
      const rows = directTableRows(table);
      const section = clean(domText(rows[0]?.querySelector('b')));
      // Failed bids and academy arrivals are not completed club transactions.
      if (!section || /^Не(?:\s|$)/i.test(section) || /спортшкол/i.test(section)) continue;
      const type = /^Куплены на трансферном рынке$/i.test(section) ? 'buy' :
        /^Проданы на трансферном рынке$/i.test(section) ? 'sell' : null;
      if (!type) continue;
      const header = rows.find(row => [...row.children].some(c => clean(domText(c)) === 'Игрок') &&
        [...row.children].some(c => clean(domText(c)) === 'День'));
      if (!header) continue;
      const labels = [...header.children].map(c => clean(domText(c)));
      const priceIndex = labels.indexOf('Цена');
      const counterpartyIndex = labels.findIndex(s => s === 'Из команды' || s === 'В команду');
      for (const row of rows) {
        const c = [...row.children];
        // VFL expands the "День" header into day and date cells.
        if (c.length !== labels.length + 1 || !/^dh\d+$/.test(c[1]?.getAttribute('title') || '')) continue;
        const player = c[labels.indexOf('Игрок') + 1]?.querySelector('a[href*="player.php?num="]');
        if (!player) continue;
        const entry = { date: clean(domText(c[1])) || null, type, section,
          playerId: param(absUrl(player.getAttribute('href'), sourceUrl), 'num'),
          playerName: clean(domText(player)) || null,
          amount: priceIndex >= 0 ? clubNumber(domText(c[priceIndex + 1])) : null,
          counterparty: counterpartyIndex >= 0 ? clean(domText(c[counterpartyIndex + 1])) || null : null,
          season };
        const history = c[1].querySelector('a[href]');
        const eventUrl = history ? absUrl(history.getAttribute('href'), sourceUrl) : null;
        const eventId = eventUrl ? param(eventUrl, 'id') : null;
        const key = eventId ? `${type}:${eventId}:${entry.playerId}` : JSON.stringify(entry);
        if (!seen.has(key)) { seen.add(key); transactions.push(entry); }
      }
    }
    return { sourceUrl, collectedAt: new Date().toISOString(), season,
      transactions };
  }

  function parseTeamStatistics(doc, sourceUrl) {
    const metrics = {};
    const root = sanitizedRoot(doc);
    const names = {1:'attendanceRating',23:'supporters',24:'stadiumCapacityRanking',17:'ownedPlayers',31:'presentPlayers',
      2:'totalSalary',9:'averageAge',21:'averageStartingAge',33:'averageStartingStrength',
      18:'s11Ranking',19:'s14Ranking',20:'s17Ranking',8:'vsRanking',10:'progressionRating',
      11:'baseValue',12:'stadiumValue',13:'buildingsValue',14:'playerValue',25:'playerValueShare',
      32:'averagePlayerValue',26:'maxPurchasePrice',15:'financeRanking',16:'teamTotalValue'};
    for (const table of root.querySelectorAll('table')) {
      const rows = directTableRows(table);
      if (!rows.some(row => clean(domText(row)).includes('Статистический показатель'))) continue;
      const headings = rows.find(row => [...row.children].map(c => clean(domText(c))).join('|') === 'лига|континент|страна|дивизион');
      if (!headings) continue;
      for (const row of rows) {
        const c = [...row.children];
        if (c.length < 6) continue;
        const labelLink = c[0].querySelector('a[href]');
        const view = labelLink ? param(absUrl(labelLink.getAttribute('href'), sourceUrl), 'view') : null;
        const key = names[view];
        if (!key) continue;
        const ranking = {};
        ['league','continent','country','division'].forEach((scope, index) => {
          const cell = c[c.length - 4 + index];
          const placeLink = cell.querySelector('a[href]');
          const changeTitle = [...cell.querySelectorAll('[title]')].map(n => n.getAttribute('title'))
            .find(title => /мест/.test(title || ''));
          const match = changeTitle?.replace(/<[^>]*>/g, '').match(/^\s*([+-]?\d[\d ]*)\s+мест/);
          ranking[scope] = { place: placeLink ? clubNumber(domText(placeLink)) : null,
            change: match ? clubNumber(match[1]) : null };
        });
        if (key.endsWith('Ranking')) metrics[key] = ranking;
        else {
          const valueCell = c[c.length - 5];
          const valueLink = valueCell.querySelector('a[href]');
          metrics[key] = { value: clubNumber(domText(valueLink || valueCell)), ranking };
        }
      }
    }
    // This analytical value has its own table, without league ranking columns.
    const success = cellValue(root, 'Успешность работы менеджера');
    if (success) metrics.managerSuccess = { value: clubNumber(domText(success)), ranking: null };
    return { sourceUrl, collectedAt: new Date().toISOString(), metrics };
  }

  async function collectClubData(teamId) {
    const result = {};
    for (const [key, pm, parse] of [['finances',6,parseClubFinances],['deals',4,parseClubDeals],['teamStatistics',3,parseTeamStatistics]]) {
      const url = `${ORIGIN}/managerzone.php?num=${encodeURIComponent(teamId)}&pm=${pm}`;
      setStatus(`Данные клуба: ${key}…`);
      const doc = await fetchDoc(url);
      if (teamIdFromManager(doc) !== String(teamId)) throw new Error('Активная команда изменилась при сборе данных клуба. Повторите сбор.');
      result[key] = parse(doc, url);
    }
    return result;
  }

  async function collectOwnTeam(maxMatches, depth, clubData = false) {
    if (!/\/managerzone\.php$/.test(location.pathname)) {
      throw new Error("Откройте https://vfliga.com/managerzone.php");
    }

    const teamId = teamIdFromManager(document);
    if (!teamId) throw new Error("Не удалось определить ID вашей команды.");

    setStatus("Читаю команду…");
    const displayedRoster = rosterCompact(document, teamId);
    // Friendlies display a fixed fatigue of 25. Read competitive current state
    // separately, while retaining the statistics selected by the user.
    const currentUrl = `${ORIGIN}/managerzone.php?sort=300`;
    const currentDoc = await fetchDoc(currentUrl);
    if (teamIdFromManager(currentDoc) !== teamId) throw new Error("Активная команда изменилась во время сбора. Повторите сбор.");
    const roster = rosterCompact(currentDoc, teamId);
    const selectedMap = rosterPlayerMap(displayedRoster);
    roster.players = roster.players.map(p => ({ ...p, selectedStats: selectedMap.get(p.id)?.selectedStats ?? p.selectedStats }));
    roster.currentStateSourceUrl = currentUrl;
    roster.selectedStatsScope = rosterScope(document);

    const histUrl = matchHistoryUrlForManager(document, teamId);
    setStatus("Читаю историю матчей команды…");
    const histDoc = await fetchDoc(histUrl);
    const recentMatches = await fetchMatches(
      pickMatches(histDoc, histUrl, maxMatches),
      "Загружаю матчи команды"
    );

    const result = {
      kind: "vfl-own-team-context",
      exporterVersion: VERSION,
      depth,
      generatedAt: new Date().toISOString(),
      teamId,
      clubDataIncluded: Boolean(clubData),
      sourceUrl: location.href,
      team: parseManagerCore(currentDoc),
      roster,
      recentMatches
    };

    if (depth === "deep") {
      result.playerDetails = await deepPlayerScan(
        roster,
        "Игроки нашей команды",
        id => `${ORIGIN}/player.php?num=${encodeURIComponent(id)}`
      );
    }

    if (clubData) Object.assign(result, await collectClubData(teamId));
    return result;
  }

  async function collectOpponent(maxMatches, depth) {
    if (!/\/managerzone\.php$/.test(location.pathname)) {
      throw new Error("Откройте https://vfliga.com/managerzone.php");
    }

    setStatus("Ищу ближайшего соперника…");
    const rosterUrl = nearestOpponentRosterUrl(document);
    if (!rosterUrl) throw new Error("Не удалось найти ближайшего соперника.");

    const opponentId = param(rosterUrl, "num");
    if (!opponentId) throw new Error("Не удалось определить ID соперника.");

    setStatus("Читаю roster соперника…");
    const rosterDoc = await fetchDoc(rosterUrl);
    const roster = rosterCompact(rosterDoc, opponentId);

    const histUrl = matchHistoryUrlForRoster(rosterDoc, opponentId, rosterUrl);
    setStatus("Читаю историю матчей соперника…");
    const histDoc = await fetchDoc(histUrl);
    const recentMatches = await fetchMatches(
      pickMatches(histDoc, histUrl, maxMatches),
      "Загружаю матчи соперника"
    );

    const result = {
      kind: "vfl-opponent-context",
      exporterVersion: VERSION,
      depth,
      generatedAt: new Date().toISOString(),
      opponentId,
      rosterUrl,
      team: parseRosterCore(rosterDoc),
      roster,
      recentMatches
    };

    if (depth === "deep") {
      result.playerDetails = await deepPlayerScan(
        roster,
        "Игроки соперника",
        id => `${ORIGIN}/player.php?num=${encodeURIComponent(id)}`
      );
    }

    return result;
  }

  async function saveJson(data, prefix) {
    const text = JSON.stringify(data, null, 2);
    try { await navigator.clipboard.writeText(text); } catch {}
    const blob = new Blob([text], {type: "application/json;charset=utf-8"});
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const id = data.teamId || data.opponentId || "context";
    a.href = u;
    a.download = `${prefix}_${data.depth}_${id}_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 1200);
    return text.length;
  }

  function setStatus(msg, kind = "info") {
    const el = document.querySelector("#vfl-assistant-status");
    if (!el) return;
    el.textContent = msg;
    el.dataset.kind = kind;
  }

  async function run(action) {
    if (run.busy) return;
    run.busy = true;
    const buttons = [...document.querySelectorAll('#vfl-assistant-panel [data-action]')];
    buttons.forEach(b => b.disabled = true);
    try {
      const maxMatches = Math.max(1, Math.min(30, Number(document.querySelector("#vfl-max-matches")?.value || 10)));
      const depth = document.querySelector("#vfl-depth")?.value || "normal";

      let data, prefix;
      if (action === "team") {
        data = await collectOwnTeam(maxMatches, depth, Boolean(document.querySelector("#vfl-club-data")?.checked));
        prefix = "vfl_team_context";
      } else if (action === "opponent") {
        data = await collectOpponent(maxMatches, depth);
        prefix = "vfl_opponent_context";
      } else {
        throw new Error("Неизвестное действие.");
      }

      window.__VFL_ASSISTANT_LAST__ = data;
      const size = await saveJson(data, prefix);
      setStatus(`Готово: ${Math.round(size/1024)} KB. JSON скачан.`, "ok");
    } catch (e) {
      console.error("[VFL Assistant]", e);
      setStatus(e.message || String(e), "error");
    } finally {
      run.busy = false;
      buttons.forEach(b => b.disabled = false);
    }
  }

  const panel = document.createElement("div");
  panel.id = "vfl-assistant-panel";
  panel.innerHTML = `
    <div class="vfl-assistant-header">
      <strong>VFL Assistant</strong>
      <span>v${VERSION}</span>
      <button id="vfl-assistant-close" title="Закрыть">×</button>
    </div>

    <div class="vfl-assistant-body">
      <div class="vfl-row">
        <label for="vfl-max-matches">Последних матчей:</label>
        <input id="vfl-max-matches" type="number" min="1" max="30" value="10">
      </div>

      <div class="vfl-row">
        <label for="vfl-depth">Глубина:</label>
        <select id="vfl-depth">
          <option value="normal" selected>Обычный сбор</option>
          <option value="deep">Глубокий сбор игроков</option>
        </select>
      </div>

      <label class="vfl-club-data" title="Только для моей команды">
        <input id="vfl-club-data" type="checkbox">
        <span>Данные клуба<small>Финансы, история сделок и командная статистика<br>Только для моей команды</small></span>
      </label>

      <button data-action="team">
        <b>Собрать мою команду</b>
        <small>managerzone + N матчей${""}</small>
      </button>

      <button data-action="opponent">
        <b>Собрать ближайшего соперника</b>
        <small>roster + N матчей</small>
      </button>

      <div id="vfl-assistant-status">Открой managerzone.php</div>
      <div class="vfl-assistant-note">
        Deep дополнительно открывает страницы игроков и найденные вкладки статистики/контракта.
        Экспорт компактнее: без полного body/tables и без script/style.
      </div>
    </div>
  `;

  document.body.appendChild(panel);
  panel.querySelectorAll("[data-action]").forEach(btn => btn.addEventListener("click", () => run(btn.dataset.action)));
  panel.querySelector("#vfl-assistant-close").addEventListener("click", () => panel.remove());
})();
