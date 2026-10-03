
(() => {
  if (window.__VFL_ASSISTANT_V05__) return;
  window.__VFL_ASSISTANT_V05__ = true;

  const VERSION = "0.5.9";
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

  // Confirmed player.php table: 16 columns, current selected season only.
  function parseRecentPlayerMatches(doc, url, maxMatches = 10, teamId = null) {
    const matches = [];
    for (const table of sanitizedRoot(doc).querySelectorAll('table')) {
      const rows = directTableRows(table);
      const header = rows.find(r => r.children.length === 16 && r.children[6].getAttribute('title') === 'Позиция' && r.children[15].getAttribute('title') === 'Сыграл минут');
      if (!header) continue;
      const goalsAreScored = header.children[11].getAttribute('title') === 'Голы';
      for (const row of rows) {
        const c = [...row.children];
        if (c.length !== 16) continue;
        const link = [...c[3].querySelectorAll('a[href]')].find(a => {
          const href = absUrl(a.getAttribute('href'), url);
          return href && new URL(href).origin === ORIGIN && new URL(href).pathname === '/viewmatch.php';
        });
        if (!link) continue;
        const matchUrl = absUrl(link.getAttribute('href'), url);
        const teams = [...c[1].querySelectorAll('a[href]')].map(a => {
          const href = absUrl(a.getAttribute('href'), url);
          const parsed = href ? new URL(href) : null;
          return { name: clean(domText(a)), id: parsed?.pathname === '/roster.php' ? parsed.searchParams.get('num') : parsed?.pathname === '/managerzone.php' ? String(teamId || '') : null };
        }).filter(t => t.id);
        const ownIndex = teamId == null ? -1 : teams.findIndex(t => t.id === String(teamId));
        const opponent = teams.length === 2 && ownIndex >= 0 ? teams[1 - ownIndex] : null;
        const value = i => clean(domText(c[i]));
        const minutes = clubNumber(value(15));
        const played = minutes != null && minutes > 0;
        const event = i => value(i) === '-' && played ? 0 : clubNumber(value(i));
        const icons = [...c[12].querySelectorAll('img')];
        const cardTitles = icons.map(i => i.getAttribute('title') || '');
        const knownCards = cardTitles.every(t => /^(Желтая карточка|Красная карточка)$/.test(t));
        const emptyCards = !value(12) && icons.length === 0;
        const cardCount = title => played && knownCards && (icons.length > 0 || emptyCards) ? cardTitles.filter(t => t === title).length : null;
        matches.push({
          date: value(0) || null, competition: value(4) || null,
          opponent: opponent?.name || null, opponentId: opponent?.id || null,
          homeAway: opponent ? (ownIndex === 0 ? 'home' : 'away') : null,
          score: /^\d+\s*:\s*\d+$/.test(clean(domText(link))) ? clean(domText(link)) : null, position: value(6) === '-' ? null : value(6) || null,
          minutes, rating: clubNumber(value(14)), goals: goalsAreScored ? event(11) : null,
          assists: event(10), yellowCards: cardCount('Желтая карточка'), redCards: cardCount('Красная карточка'),
          playerStrength: clubNumber(value(7)), matchUrl
        });
      }
    }
    return uniq(matches, m => m.matchUrl).sort((a,b) => (clubNumber(param(b.matchUrl, 'day')) || 0) - (clubNumber(param(a.matchUrl, 'day')) || 0)).slice(0, Math.max(0, maxMatches));
  }

  function parsePlayerInfo(doc, url, playerId, maxMatches = 10, teamId = null) {
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
      recentMatches: parseRecentPlayerMatches(doc, url, maxMatches, teamId),
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
    const root = sanitizedRoot(doc);
    const text = safeBodyText(doc, 30000);
    const proposal = text.match(/в контракте на [\s\S]*?точно устроит зарплата\s*[\d ]+\s*за тур/i)?.[0] || '';
    const history = [];
    for (const table of root.querySelectorAll('table')) {
      const rows = directTableRows(table);
      if (!rows.some(r => r.children.length === 5 && clean(domText(r.children[0])) === 'Дата подписания' && clean(domText(r.children[3])) === 'Дата окончания')) continue;
      for (const row of rows) {
        const c = [...row.children];
        if (c.length !== 9 || !/^Сезон:/.test(c[0].getAttribute('title') || '') || !/^День:/.test(c[1].getAttribute('title') || '')) continue;
        const val = i => clean(domText(c[i])) || null;
        history.push({ signedSeason: clubNumber(val(0)), signedDay: clubNumber(val(1)), signedAt: val(2), team: val(3), term: val(4), endsAt: val(7), salaryPerTour: clubNumber(val(8)) });
      }
    }
    const factors = [];
    for (const fieldset of root.querySelectorAll('fieldset')) {
      for (const row of fieldset.children) {
        if (row.tagName !== 'DIV') continue;
        const percentNode = row.children[0];
        const raw = clean(domText(percentNode));
        if (!/^[+-]\d+(?:[.,]\d+)?%$/.test(raw)) continue;
        const clone = row.cloneNode(true);
        clone.children[0].remove();
        const label = clean(domText(clone)).replace(/:$/, '');
        if (label) factors.push({ label, percent: clubNumber(raw) });
      }
    }
    const adjustment = text.match(/Итого:\s*требования игрока\s*(меньше|больше) базовых на\s*(\d+(?:[.,]\d+)?)\s*%/i);
    const current = {
      team: clean(domText(cellValue(root, 'Команда'))) || null,
      manager: clean(domText(cellValue(root, 'Менеджер, заключивший контракт'))) || null,
      signedSeason: cellNumber(root, 'Сезон подписания контракта'),
      signedDay: cellNumber(root, 'День подписания'),
      signedAt: clean(domText(cellValue(root, 'Дата подписания'))) || null,
      term: clean(domText(cellValue(root, 'Срок'))) || null,
      salaryPerTour: cellNumber(root, 'Зарплата'),
      endsAt: null
    };
    // An end date is available in the matching displayed historical signing.
    current.endsAt = history.find(h => h.signedSeason === current.signedSeason && h.signedDay === current.signedDay && h.signedAt === current.signedAt && h.team === current.team)?.endsAt || null;
    return {
      playerId: String(playerId), url, current,
      renewal: {
        requestedSalaryPerTour: clubNumber(clean(domText(root.querySelector('#hgreen')))) ?? textNumber(proposal, /точно устроит зарплата\s*([\d ]+)\s*за тур/i),
        availableTerm: clean(domText(root.querySelector('#sdescr'))) || textValue(proposal, /в контракте на\s*(.*?)\s*\(/i),
        baseSalaryNextSeason: cellNumber(root, 'Базовая зарплата следующего сезона'),
        adjustmentPercent: adjustment ? Number(adjustment[2].replace(',', '.')) * (adjustment[1].toLowerCase() === 'меньше' ? -1 : 1) : null,
        factors
      },
      history
    };
  }

  function mergePlayerDetails(rosterPlayer, info, stats, contract, mode = "own") {
    return {
      playerId: String(rosterPlayer?.id || info?.playerId || stats?.playerId || contract?.playerId || ""),
      name: rosterPlayer?.name ?? null,
      country: rosterPlayer?.country ?? null,
      position: rosterPlayer?.position ?? null,
      age: rosterPlayer?.age ?? null,
      strength: rosterPlayer?.strength ?? null,
      fatigue: rosterPlayer?.fatigue ?? null,
      form: rosterPlayer?.form ?? null,
      formTrend: rosterPlayer?.formTrend ?? null,
      realStrength: rosterPlayer?.realStrength ?? null,
      specials: rosterPlayer?.specials ?? [],
      selectedStats: rosterPlayer?.selectedStats ?? null,
      info: info || null,
      ...(mode === "own" ? { stats: stats ? { ...stats, seasonMinutes: info?.seasonMinutes ?? null } : null, contract: contract || null } : {})
    };
  }

  async function deepPlayerScan(roster, progressLabel, baseUrlBuilder, { mode = "own", maxMatches = 10, teamId = null } = {}) {
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
        info = parsePlayerInfo(infoDoc, url, id, maxMatches, teamId);

        const tabs = mode === "own" ? detectPlayerTabLinks(infoDoc, id, url) : {};

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

      out.push(mergePlayerDetails(rmap.get(id), info, stats, contract, mode));
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

  function managementText(doc) {
    return safeBodyText(doc, 200000).replace(/\s+/g, ' ');
  }

  function managementHeader(doc, name) {
    const text = managementText(doc);
    const start = text.indexOf(name);
    return start < 0 ? '' : text.slice(start, start + 2500);
  }

  function managementPair(text, label) {
    const m = text.match(new RegExp(label + '\\s*:\\s*(\\d+)\\s*из\\s*(\\d+)', 'i'));
    return { remaining: m ? Number(m[1]) : null, total: m ? Number(m[2]) : null };
  }

  function managementSelectedSeason(doc, name = 'season') {
    const select = [...doc.querySelectorAll('select')].find(s => s.getAttribute('name') === name);
    return clubNumber(select?.querySelector('option:checked,option[selected]')?.getAttribute('value') || '');
  }

  function managementPlayer(row, nameCell, base) {
    const link = [...row.querySelectorAll('a[href]')].find(a => {
      const href = absUrl(a.getAttribute('href'), base);
      return href && new URL(href).pathname === '/player.php' && /^\d+$/.test(param(href, 'num') || '');
    });
    const hidden = [...row.querySelectorAll('input')].find(i => /^del_plr_id\[\d+\]$/.test(i.getAttribute('name') || ''));
    const id = link ? param(absUrl(link.getAttribute('href'), base), 'num') : hidden?.getAttribute('value');
    return { playerId: /^\d+$/.test(id || '') ? String(id) : null, playerName: clean(domText(link || nameCell)) || null };
  }

  function managementValue(cell) {
    const raw = clean(domText(cell));
    // Short explanatory titles may reveal a range, but tooltip lists/icons do not.
    const title = cell?.getAttribute('title') || cell?.querySelector('[title]')?.getAttribute('title') || '';
    return raw || (title && title.length < 150 && !/[<>]/.test(title) ? clean(title) : null);
  }

  function managementStudyResult(raw) {
    if (!raw || raw === '-' || raw === '?') return null;
    const m = raw.match(/^(\d+)\s*из\s*(\d+)$/);
    return m ? { level: Number(m[1]), maxLevel: Number(m[2]), raw } : { level: null, maxLevel: null, raw };
  }

  function parseTrainingCenter(doc, sourceUrl) {
    const text = managementHeader(doc, 'Тренировочный центр');
    const speed = text.match(/Скорость тренировки:\s*(\d+)\s*%(?:\s*-\s*(\d+)\s*%)?\s*за тур/i);
    const strength = managementPair(text, 'Осталось тренировок силы');
    const specials = managementPair(text, 'Осталось спецвозможностей');
    const positions = managementPair(text, 'Осталось совмещений');
    const strengthSection = text.match(/Осталось тренировок силы:[\s\S]*?(?=Осталось спецвозможностей|$)/i)?.[0] || '';
    strength.maxPerPlayer = textNumber(strengthSection, /Одному игроку не более:\s*(\d+)/i);
    const specialSection = text.match(/Осталось спецвозможностей:[\s\S]*?(?=Осталось совмещений|$)/i)?.[0] || '';
    specials.maxPerPlayer = textNumber(specialSection, /Одному игроку не более:\s*(\d+)/i);
    positions.replacementCostUnits = textNumber(text, /1 замена позиции\s*=\s*(\d+)\s*совмещ/i);
    const costText = text.match(/Стоимость тренировок:([\s\S]*?)(?:Тренировка игроков|Здесь|$)/i)?.[1] || '';
    const costRange = label => {
      const m = costText.match(new RegExp(label + ':\\s*([\\d ]+)(?:\\s*-\\s*([\\d ]+))?', 'i'));
      return { min: m ? clubNumber(m[1]) : null, max: m ? clubNumber(m[2] || m[1]) : null };
    };
    const strengthCost = costRange('Сила');
    const positionCost = costRange('Позиция');
    const active = [];
    // Only the target string has been confirmed. Numeric training codes are not decoded.
    const states = new Map();
    const rawStates = doc.documentElement.innerHTML.match(/\bvar arr_plr_basetraining\s*=\s*\{([^}]+)\}/)?.[1] || '';
    for (const m of rawStates.matchAll(/(\d+)\s*:\s*\[([^\]]+)\]/g)) {
      const args = splitJsArgs(m[2]);
      if (typeof args[3] === 'string') states.set(m[1], args[3]);
    }
    for (const table of sanitizedRoot(doc).querySelectorAll('table')) {
      const rows = directTableRows(table);
      if (!rows.some(r => r.children.length === 16 && r.children[8].getAttribute('title') === 'Дней на тренировке' && r.children[9].getAttribute('title') === 'Прогресс тренировки')) continue;
      for (const row of rows) {
        const c = [...row.children];
        if (c.length !== 17) continue;
        const player = managementPlayer(row, c[2], sourceUrl);
        if (!player.playerId) continue;
        active.push({ ...player, trainingType: null, result: states.get(player.playerId) || null,
          days: clubNumber(clean(domText(c[9]))), progressPercent: clubNumber(clean(domText(c[10]))), cost: clubNumber(clean(domText(c[7]))) });
      }
    }
    return { sourceUrl, collectedAt: new Date().toISOString(), center: {
      level: textNumber(text, /Уровень:\s*(\d+)/i),
      speedPercentPerTour: speed && !speed[2] ? Number(speed[1]) : null,
      speedPercentRange: { min: speed ? Number(speed[1]) : null, max: speed ? Number(speed[2] || speed[1]) : null },
      capacity: { currentPlayers: textNumber(text, /Игроков на тренировке:\s*(\d+)\s*из/i), maxPlayers: textNumber(text, /Игроков на тренировке:\s*\d+\s*из\s*(\d+)/i) },
      resources: { strength, specials, positions },
      costs: { strength: strengthCost.min === strengthCost.max ? strengthCost.min : null, strengthMin: strengthCost.min, strengthMax: strengthCost.max,
        special: textNumber(costText, /Спецвозможность:\s*([\d ]+)/i), positionMin: positionCost.min, positionMax: positionCost.max }
    }, active, history: [] };
  }

  function parseTrainingHistory(doc, sourceUrl, season) {
    const events = [];
    for (const table of sanitizedRoot(doc).querySelectorAll('table')) {
      const rows = directTableRows(table);
      if (!rows.some(r => r.children.length === 10 && r.children[8].getAttribute('title') === 'Описание проведенной тренировки')) continue;
      for (const row of rows) {
        const c = [...row.children];
        if (c.length !== 11 || !/^Сезон:/.test(c[0].getAttribute('title') || '')) continue;
        if (clubNumber(clean(domText(c[0]))) !== season) continue;
        const player = managementPlayer(row, c[3], sourceUrl);
        if (!player.playerId) continue;
        events.push({ ...player, season, day: clubNumber(clean(domText(c[1]))), date: clean(domText(c[2])) || null,
          result: clean(domText(c[9])) || null, cost: clubNumber(clean(domText(c[10]))) });
      }
    }
    return events;
  }

  function parseScoutingCenter(doc, sourceUrl) {
    const text = managementHeader(doc, 'Скаут-центр');
    const active = [];
    for (const table of sanitizedRoot(doc).querySelectorAll('table')) {
      const rows = directTableRows(table);
      if (!rows.some(r => r.children.length === 16 && clean(domText(r.children[9])) === 'Изучает' && r.children[13].getAttribute('title') === 'Прогресс изучения')) continue;
      for (const row of rows) {
        const c = [...row.children];
        if (c.length !== 17) continue;
        const player = managementPlayer(row, c[2], sourceUrl);
        if (!player.playerId) continue;
        active.push({ ...player, studyType: clean(domText(c[10])) || null,
          currentValue: managementValue(c[11]), expectedValue: managementValue(c[12]),
          turns: clubNumber(clean(domText(c[13]))), progressPercent: clubNumber(clean(domText(c[14]))) });
      }
    }
    return { sourceUrl, collectedAt: new Date().toISOString(), center: {
      level: textNumber(text, /Уровень:\s*(\d+)/i),
      speedPercent: { min: textNumber(text, /Скорость изучения:\s*(\d+)\s*%/i), max: textNumber(text, /Скорость изучения:\s*\d+\s*%\s*-\s*(\d+)\s*%/i) },
      costPerStudy: textNumber(text, /Стоимость любого изучения:\s*([\d ]+)/i)
    }, resources: {
      styles: managementPair(text, 'Осталось изучений стилей'), growth: managementPair(text, 'Осталось изучений роста силы'),
      decline: managementPair(text, 'Осталось изучений потери силы'), injury: managementPair(text, 'Осталось изучений травматичности'), loyalty: managementPair(text, 'Осталось изучений лояльности')
    }, active, completed: [] };
  }

  function parseScoutingHistory(doc, sourceUrl) {
    const active = [], completed = [];
    for (const table of sanitizedRoot(doc).querySelectorAll('table')) {
      const rows = directTableRows(table);
      const section = rows.find(r => r.children.length === 1)?.children[0];
      const label = clean(domText(section));
      if (!/^(На изучении|Завершено изучений):$/.test(label)) continue;
      for (const row of rows) {
        const c = [...row.children];
        if (c.length !== 4) continue;
        const current = label === 'На изучении:';
        const player = managementPlayer(row, c[current ? 0 : 1], sourceUrl);
        if (!player.playerId) continue;
        if (current) active.push({ ...player, studyType: clean(domText(c[1])) || null, progressPercent: clubNumber(clean(domText(c[2]))), days: clubNumber(clean(domText(c[3]))) });
        else completed.push({ ...player, date: clean(domText(c[0])) || null, studyType: clean(domText(c[2])) || null, result: managementStudyResult(clean(domText(c[3]))) });
      }
    }
    return { active, completed };
  }

  function managementForm(cell) {
    const title = cell?.getAttribute('title') || cell?.querySelector('[title]')?.getAttribute('title') || '';
    const raw = clean(title || domText(cell));
    const m = raw.match(/^(\d+)%,\s*(раст[её]т|падает)$/i);
    return m ? { percent: Number(m[1]), trend: /раст/i.test(m[2]) ? 'rising' : 'falling' } : null;
  }

  function parseFitnessCenter(doc, sourceUrl) {
    const text = managementHeader(doc, 'Центр физподготовки');
    const changes = managementPair(text, 'Осталось изменений физ\\. формы');
    changes.planned = textNumber(text, /Запланировано всего изменений:\s*(\d+)/i);
    changes.nextGameDay = textNumber(text, /В ближайший игровой день:\s*(\d+)/i);
    return { sourceUrl, collectedAt: new Date().toISOString(), center: {
      level: textNumber(text, /Уровень:\s*(\d+)/i), fatigueRecoveryBonusPercent: textNumber(text, /Усталость восстанавливается на\s*(\d+)\s*%\s*лучше/i), changes
    }, planned: [], completed: [], cancelled: [] };
  }

  function parseFitnessHistory(doc, sourceUrl, season) {
    const out = { planned: [], completed: [], cancelled: [], scopeWarnings: [] };
    for (const table of sanitizedRoot(doc).querySelectorAll('table')) {
      const rows = directTableRows(table);
      const header = rows.find(r => r.children.length === 9 && clean(domText(r.children[7])) === 'Было');
      if (!header) continue;
      const last = clean(domText(header.children[8]));
      const key = { 'Будет': 'planned', 'Стало': 'completed', 'Ошибка': 'cancelled' }[last];
      if (!key) continue;
      for (const row of rows) {
        const c = [...row.children];
        if (c.length !== 10) continue;
        const player = managementPlayer(row, c[2], sourceUrl);
        if (!player.playerId) continue;
        // page=2 has no season selector. Never assume that an undated past event
        // belongs to the current season. Future plans are the current operational state.
        const rowSeason = [...row.querySelectorAll('[title]')].map(n => n.getAttribute('title')).join(' ').match(/Сезон:\s*(\d+)/i);
        if (rowSeason && Number(rowSeason[1]) !== season) continue;
        if (key !== 'planned' && !rowSeason) {
          if (!out.scopeWarnings.includes('Прошедшие изменения формы без подтверждённого сезона исключены.')) out.scopeWarnings.push('Прошедшие изменения формы без подтверждённого сезона исключены.');
          continue;
        }
        const event = { ...player, day: clubNumber(clean(domText(c[0]))), date: clean(domText(c[1])) || null, oldForm: managementForm(c[8]) };
        if (key === 'cancelled') event.error = clean(domText(c[9])) || null;
        else event.newForm = managementForm(c[9]);
        out[key].push(event);
      }
    }
    return out;
  }

  async function collectManagement(teamId, season) {
    if (!Number.isInteger(season) || season < 1) throw new Error('Не удалось подтвердить текущий сезон для Management.');
    const pages = {};
    const paths = {
      training: '/mng_base_train.php', trainingHistory: `/mng_base_train_history.php?a=${season}&b=${season}`,
      scouting: '/mng_scout_styles.php', scoutingHistory: `/mng_scout_styles_history.php?season=${season}`,
      fitness: '/mng_base_ch.php?page=1', fitnessHistory: '/mng_base_ch.php?page=2'
    };
    for (const [key, path] of Object.entries(paths)) {
      setStatus(`Менеджмент команды: ${key}…`);
      const url = ORIGIN + path;
      const doc = await fetchDoc(url);
      const linkIds = collectLinks(doc, url).filter(l => new URL(l.href).pathname === '/roster.php').map(l => param(l.href, 'num')).filter(Boolean);
      const actualId = teamIdFromManager(doc) || linkIds[0];
      if (actualId !== String(teamId)) throw new Error('Активная команда изменилась при сборе менеджмента. Повторите сбор.');
      pages[key] = { doc, url };
    }
    const th = pages.trainingHistory, sh = pages.scoutingHistory;
    if (managementSelectedSeason(th.doc, 'a') !== season || managementSelectedSeason(th.doc, 'b') !== season || managementSelectedSeason(sh.doc) !== season) throw new Error('Management history: выбран не текущий сезон. Повторите сбор.');
    const training = parseTrainingCenter(pages.training.doc, pages.training.url);
    training.history = parseTrainingHistory(th.doc, th.url, season);
    training.historySourceUrl = th.url;
    training.season = season;
    const scouting = parseScoutingCenter(pages.scouting.doc, pages.scouting.url);
    const scoutHistory = parseScoutingHistory(sh.doc, sh.url);
    const current = new Map(scouting.active.map(p => [p.playerId, p]));
    for (const p of scoutHistory.active) current.set(p.playerId, { ...current.get(p.playerId), ...p });
    scouting.active = [...current.values()];
    scouting.completed = scoutHistory.completed;
    scouting.historySourceUrl = sh.url;
    scouting.season = season;
    const fitness = { ...parseFitnessCenter(pages.fitness.doc, pages.fitness.url), ...parseFitnessHistory(pages.fitnessHistory.doc, pages.fitnessHistory.url, season), historySourceUrl: pages.fitnessHistory.url, season };
    return { training, scouting, fitness };
  }

  // Confirmed through VFL's live GET form and column-header navigation, 2026-10-03.
  // Empty bounds are submitted exactly as the native search form submits them:
  // VFL normalizes them itself (including its special unrestricted maxP value).
  const TRANSFER_POSITIONS = ["GK","XX","DF","MD","FW","R","L","C","LD","CD","RD","LM","CM","RM","LF","CF","RF"];
  const TRANSFER_STYLES = ["Спартаковский","Бей-беги","Бразильский","Тики-така","Катеначчо","Британский"];
  const TRANSFER_SORTS = { strength: 5, price: 7, specials: 13, age: 3 };
  const TRANSFER_BOUNDS = { age: ["minA","maxA"], price: ["minS","maxS"], strength: ["minP","maxP"], askingPercent: ["minX","maxX"] };
  const TRANSFER_DEFAULTS = {
    find_load: "1", status: "1", page: "1", day: "-3", sstyle: "1", sort: "7",
    pz1: "", pz2: "", andor: "and", rf1: "1", rf2: "1", rf3: "1",
    sp1: "", sp2: "", sp3: "", sp4: "", nat_id: "", minN: "", maxN: "",
    minRS: "", maxRS: "", minPS: "", maxPS: "", minTS: "", maxTS: "", minGS: "", maxGS: "",
    minO: "", maxO: "", style_level: "0", show_retired: "0",
    show_noretire_1: "1", show_noretire_2: "1", R_unexplored: "1", P_unexplored: "0", T_unexplored: "0", G_unexplored: "0"
  };

  function transferFilters(input = {}) {
    const position = clean(String(input.position ?? ""));
    if (position && !TRANSFER_POSITIONS.includes(position)) throw new Error("Неизвестная позиция рынка.");
    const style = input.style === "" || input.style == null ? null : Number(input.style);
    if (style !== null && (!Number.isInteger(style) || style < 1 || style > 6)) throw new Error("Неизвестный стиль рынка.");
    const filters = { position: position || null, style };
    for (const key of Object.keys(TRANSFER_BOUNDS)) {
      const pair = {};
      for (const bound of ["min", "max"]) {
        const raw = String(input[key]?.[bound] ?? "").replace(/[\s\u00a0]/g, "");
        if (raw && !/^\d+$/.test(raw)) throw new Error("Границы фильтров должны быть целыми неотрицательными числами.");
        pair[bound] = raw ? Number(raw) : null;
        if (pair[bound] !== null && !Number.isSafeInteger(pair[bound])) throw new Error("Слишком большое значение фильтра.");
      }
      if (pair.min !== null && pair.max !== null && pair.min > pair.max) throw new Error("Минимум фильтра больше максимума.");
      filters[key] = pair;
    }
    return filters;
  }

  function transferSearchUrl(filters, nativeSort = null) {
    const url = new URL("https://vfliga.com/transferlist.php");
    for (const [key, value] of Object.entries(TRANSFER_DEFAULTS)) url.searchParams.set(key, value);
    url.searchParams.set("pz1", filters.position || "");
    for (const [key, params] of Object.entries(TRANSFER_BOUNDS)) {
      ["min", "max"].forEach((bound, i) => url.searchParams.set(params[i], filters[key][bound] ?? ""));
    }
    for (let id = 1; id <= 6; id++) url.searchParams.set(`plr_style_${id}`, filters.style === id ? "1" : "0");
    if (nativeSort !== null) {
      if (!Object.values(TRANSFER_SORTS).includes(nativeSort)) throw new Error("Неизвестная сортировка рынка.");
      url.searchParams.set("sort", nativeSort);
    }
    return url.href;
  }

  function transferTitle(node) {
    return clean((node?.getAttribute("title") || node?.getAttribute("alt") || "").replace(/<[^>]*>/g, " "));
  }

  function transferRaw(cell) {
    if (!cell) return "";
    const text = clean(domText(cell));
    const titles = uniq([transferTitle(cell), ...[...cell.querySelectorAll("[title],img")].map(transferTitle)].filter(Boolean));
    return uniq([text, ...titles].filter(Boolean)).join("; ");
  }

  function transferPartial(cell) {
    const raw = transferRaw(cell);
    const range = raw.match(/от\s+(\d+)%\s+до\s+(\d+)%/i);
    const percent = !range && /^\d+%$/.test(raw) ? clubNumber(raw) : null;
    const stars = raw.match(/^[★☆]+$/);
    return { percent, min: range ? Number(range[1]) : null, max: range ? Number(range[2]) : null,
      level: stars ? [...raw].filter(s => s === "★").length : null,
      maxLevel: stars ? [...raw].length : null, raw: raw || null };
  }

  function transferStyle(cell) {
    const raw = transferRaw(cell);
    const names = uniq([clean(domText(cell)), transferTitle(cell), ...[...(cell?.querySelectorAll("[title],img") || [])].map(transferTitle)]
      .filter(name => TRANSFER_STYLES.includes(name)));
    const possibleStyles = names.map(label => ({ id: TRANSFER_STYLES.indexOf(label) + 1, label }));
    return { id: names.length === 1 ? possibleStyles[0].id : null, label: names.length === 1 ? names[0] : null, possibleStyles, raw: raw || null };
  }

  function transferTable(doc) {
    const root = sanitizedRoot(doc);
    for (const table of root.querySelectorAll("table")) {
      const rows = directTableRows(table);
      const header = rows.find(row => [...row.children].some(c => c.getAttribute("title") === "Сила игрока") &&
        [...row.children].some(c => clean(domText(c)) === "Игрок"));
      if (header) return { rows, header };
    }
    return null;
  }

  function transferColumns(header) {
    const cells = [...header.children].filter(c => /^(TD|TH)$/.test(c.tagName));
    const titles = { nationality: "Национальность игрока", position: "Позиция игрока", age: "Возраст игрока",
      strength: "Сила игрока", fatigue: "Усталость игрока", form: "Форма игрока", specials: "Спецвозможности игрока",
      style: "Любимый стиль игрока", growth: "Рост силы игрока", decline: "Падение силы игрока", value: "Стоимость игрока" };
    const cols = { rank: cells.findIndex(c => clean(domText(c)) === "№"), playerName: cells.findIndex(c => clean(domText(c)) === "Игрок") };
    for (const [key, title] of Object.entries(titles)) cols[key] = cells.findIndex(c => c.getAttribute("title") === title);
    cols.bidsCount = cells.findIndex(c => (c.getAttribute("title") || "").startsWith("Число заявок на покупку игрока"));
    cols.askingPercent = cells.findIndex(c => c.getAttribute("title") === "Начальная цена игрока на рынке (в %)");
    cols.askingPrice = cells.findIndex(c => c.getAttribute("title") === "Начальная цена игрока на рынке (в тыс. всоликов)");
    return { cols, width: cells.length };
  }

  // URLs are rebuilt with the single confirmed identifier; unrelated query data
  // and authenticated page state never enter the export.
  function transferLink(row, base, path, key) {
    for (const a of row.querySelectorAll("a[href]")) {
      let url;
      try { url = new URL(a.getAttribute("href"), base); } catch { continue; }
      const id = url.searchParams.get(key);
      if (["vfliga.com", "www.vfliga.com"].includes(url.hostname) && url.pathname === path && /^\d+$/.test(id || "")) {
        const safe = new URL(path, "https://vfliga.com"); safe.searchParams.set(key, id);
        return { id, url: safe.href, name: clean(domText(a)) };
      }
    }
    return null;
  }

  function transferRow(row, columns, sourceUrl) {
    const cells = [...row.children].filter(c => /^(TD|TH)$/.test(c.tagName));
    if (cells.length !== columns.width) return null; // Never shift a malformed row.
    const cell = key => columns.cols[key] >= 0 ? cells[columns.cols[key]] : null;
    const nameCell = cell("playerName");
    const namedOrder = transferLink(nameCell || row, sourceUrl, "/mng_orderplr.php", "id");
    const namedProfile = transferLink(nameCell || row, sourceUrl, "/player.php", "num");
    const rowOrder = namedOrder || transferLink(row, sourceUrl, "/mng_orderplr.php", "id");
    const rowProfile = namedProfile || transferLink(row, sourceUrl, "/player.php", "num");
    const link = namedOrder || namedProfile || rowOrder || rowProfile;
    if (!link) return null;
    const order = rowOrder?.id === link.id ? rowOrder : null;
    const profile = rowProfile?.id === link.id ? rowProfile : null;
    const raw = {};
    for (const key of Object.keys(columns.cols)) raw[key] = transferRaw(cell(key)) || null;
    const formRaw = raw.form || "";
    const formMatch = formRaw.match(/(?:^|;\s*)(\d+)%/);
    const trend = /раст[её]т/i.test(formRaw) ? "rising" : /падает/i.test(formRaw) ? "falling" : null;
    const bidsRaw = clean(domText(cell("bidsCount")));
    const bidsTitle = transferTitle(cell("bidsCount"));
    const statuses = uniq([...(nameCell?.querySelectorAll("[title],img") || [])].map(transferTitle)
      .filter(s => s && !/^star_\d+$/.test(s)));
    // The market has an extra decorative cell before the name; semantic tooltip
    // text is retained, but unknown sprite classes are not decoded.
    if (columns.cols.playerName === 2) statuses.push(...[...cells[1].querySelectorAll("[title]")].map(transferTitle).filter(s => s && !/^star_\d+$/.test(s)));
    return { rank: clubNumber(clean(domText(cell("rank"))).replace(/\.$/, "")), playerId: link.id,
      playerName: namedOrder?.name || namedProfile?.name || clean(domText(nameCell)) || null,
      playerUrl: profile?.url || null, orderUrl: order?.url || `https://vfliga.com/mng_orderplr.php?id=${link.id}`,
      nationality: transferTitle(cell("nationality")) || transferRaw(cell("nationality")) || null,
      position: clean(domText(cell("position"))) || null,
      age: clubNumber(clean(domText(cell("age")))), strength: clubNumber(clean(domText(cell("strength")))),
      fatigue: clubNumber(clean(domText(cell("fatigue")))), form: formMatch ? Number(formMatch[1]) : clubNumber(clean(domText(cell("form")))), formTrend: trend,
      specials: clean(domText(cell("specials"))) || null, style: transferStyle(cell("style")),
      growth: transferPartial(cell("growth")), decline: transferPartial(cell("decline")), value: clubNumber(clean(domText(cell("value")))),
      bidsCount: bidsRaw === "-" && bidsTitle === "Нет заявок" ? 0 : clubNumber(bidsRaw),
      askingPercent: clubNumber(clean(domText(cell("askingPercent")))), askingPrice: clubNumber(clean(domText(cell("askingPrice")))),
      statuses: uniq(statuses), raw };
  }

  function parseTransferSearch(doc, sourceUrl) {
    const text = safeBodyText(doc, 200000);
    const range = text.match(/Всего\s+([\d\s]+)\s+игрок(?:ов|а)?\.\s*Показаны\s+с\s+(\d+)\s+по\s+(\d+)/i);
    const totalOnly = text.match(/Всего\s+(\d+)\s+игрок(?:ов|а)?/i);
    const empty = /Не найдено ни одного игрока на рынке\. Попробуйте расширить круг поиска/i.test(text);
    const totalResults = range ? Number(range[1].replace(/\s/g, "")) : totalOnly ? Number(totalOnly[1]) : empty ? 0 : null;
    const table = transferTable(doc);
    const columns = table ? transferColumns(table.header) : null;
    const players = table ? table.rows.map(row => transferRow(row, columns, sourceUrl)).filter(Boolean).slice(0,50) : [];
    return { pagination: { totalResults, totalPages: totalResults === null ? null : Math.ceil(totalResults / 50), page: 1, pageSize: 50,
      shownFrom: range ? Number(range[2]) : totalResults === 0 ? 0 : null, shownTo: range ? Number(range[3]) : totalResults === 0 ? 0 : null }, players };
  }

  function parseTransferBids(doc, sourceUrl) {
    const purchaseLimits = {};
    for (const key of ["total","GK","LD","CD","RD","LM","CM","RM","LF","CF","RF"]) {
      const select = doc.querySelector(`#transfer_${key.toLowerCase()}`);
      const option = select?.querySelector("option:checked,option[selected]");
      purchaseLimits[key] = clubNumber(option?.getAttribute("value") ?? "");
    }
    const table = transferTable(doc), bids = [];
    if (table) {
      const columns = transferColumns(table.header);
      let current = null, auction = null;
      for (const row of table.rows) {
        const cells = [...row.children].filter(c => /^(TD|TH)$/.test(c.tagName));
        if (cells.length === 2 && /^День\s+\d+$/.test(cells[0].getAttribute("title") || "")) {
          auction = { day: clubNumber(cells[0].getAttribute("title").replace("День", "")), date: clean(domText(cells[0])) || null, competition: clean(domText(cells[1])) || null };
          current = null;
        }
        const player = transferRow(row, columns, sourceUrl);
        if (player) { current = { ...player, auction, bidPrice: null, bidPercent: null, bidRaw: { price: null, percent: null } }; bids.push(current); continue; }
        if (cells.length === columns.width || [...row.querySelectorAll("a[href]")].some(a => /mng_orderplr\.php/.test(a.getAttribute("href") || ""))) current = null;
        if (current && /Ваша заявка:/.test(clean(domText(row)))) {
          const input = [...row.querySelectorAll("input")].find(e => /^price_\d+$/.test(e.getAttribute("id") || ""));
          const amount = clubNumber(input?.getAttribute("value") ?? "");
          // Confirmed input is in thousands, followed by the literal 000 unit.
          current.bidPrice = amount === null ? null : amount * 1000;
          const percent = [...row.querySelectorAll("[id]")].find(e => /^percent_\d+$/.test(e.getAttribute("id") || ""));
          current.bidPercent = clubNumber(clean(domText(percent)));
          current.bidRaw = { price: input?.getAttribute("value") ?? null, percent: clean(domText(percent)) || null };
        }
      }
    }
    return { sourceUrl, collectedAt: new Date().toISOString(), purchaseLimits, bids };
  }

  async function collectTransferMarket(input, requested = "strength") {
    if (!Object.hasOwn(TRANSFER_SORTS, requested)) throw new Error("Неизвестная сортировка рынка.");
    const filters = transferFilters(input);
    setStatus("Ищу игроков на трансферном рынке…");
    let sourceUrl = transferSearchUrl(filters);
    let result = parseTransferSearch(await fetchDoc(sourceUrl), sourceUrl);
    if (result.pagination.totalPages === null) throw new Error("Не удалось прочитать количество результатов рынка. Проверьте авторизацию VFL.");
    let applied = false;
    if (result.pagination.totalPages > 1) {
      sourceUrl = transferSearchUrl(filters, TRANSFER_SORTS[requested]);
      setStatus("Применяю сортировку к первой странице рынка…");
      result = parseTransferSearch(await fetchDoc(sourceUrl), sourceUrl);
      if (result.pagination.totalPages === null) throw new Error("Не удалось прочитать отсортированный результат рынка.");
      applied = true;
    }
    return { kind: "vfl-transfer-market", exporterVersion: VERSION, generatedAt: new Date().toISOString(),
      management: { transferMarket: { sourceUrl, collectedAt: new Date().toISOString(), search: {
        filters, sort: { requested, applied, nativeSort: applied ? TRANSFER_SORTS[requested] : null }, ...result } } } };
  }

  async function collectTransferBids() {
    const sourceUrl = "https://vfliga.com/transferlist.php?status=2&day=-3";
    setStatus("Читаю текущие заявки на покупку…");
    const doc = await fetchDoc(sourceUrl);
    if (!doc.querySelector("#transfer_total")) throw new Error("Не удалось прочитать мои заявки. Проверьте авторизацию VFL.");
    return { kind: "vfl-transfer-bids", exporterVersion: VERSION, generatedAt: new Date().toISOString(),
      management: { transferMarket: { myBids: parseTransferBids(doc, sourceUrl) } } };
  }

  function transferUiFilters() {
    const input = { position: document.querySelector("#vfl-market-position")?.value, style: document.querySelector("#vfl-market-style")?.value };
    for (const key of Object.keys(TRANSFER_BOUNDS)) input[key] = { min: document.querySelector(`#vfl-market-${key}-min`)?.value, max: document.querySelector(`#vfl-market-${key}-max`)?.value };
    return input;
  }

  async function collectOwnTeam(maxMatches, depth, clubData = false, management = false) {
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
      managementIncluded: Boolean(management),
      sourceUrl: location.href,
      team: parseManagerCore(currentDoc),
      roster,
      recentMatches
    };

    if (depth === "deep") {
      result.playerDetails = await deepPlayerScan(
        roster,
        "Игроки нашей команды",
        id => `${ORIGIN}/player.php?num=${encodeURIComponent(id)}`,
        { mode: "own", maxMatches, teamId }
      );
    }

    if (clubData) Object.assign(result, await collectClubData(teamId));
    if (management) result.management = await collectManagement(teamId, rosterScope(currentDoc).season);
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
        id => `${ORIGIN}/player.php?num=${encodeURIComponent(id)}`,
        { mode: "opponent", maxMatches, teamId: opponentId }
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
    a.download = `${prefix}_${data.depth || "query"}_${id}_${new Date().toISOString().slice(0,10)}.json`;
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
        data = await collectOwnTeam(maxMatches, depth, Boolean(document.querySelector("#vfl-club-data")?.checked), Boolean(document.querySelector("#vfl-management")?.checked));
        prefix = "vfl_team_context";
      } else if (action === "opponent") {
        data = await collectOpponent(maxMatches, depth);
        prefix = "vfl_opponent_context";
      } else if (action === "market") {
        data = await collectTransferMarket(transferUiFilters(), document.querySelector("#vfl-market-sort")?.value || "strength");
        prefix = "vfl_transfer_market";
      } else if (action === "bids") {
        data = await collectTransferBids();
        prefix = "vfl_transfer_bids";
      } else {
        throw new Error("Неизвестное действие.");
      }

      window.__VFL_ASSISTANT_LAST__ = data;
      const size = await saveJson(data, prefix);
      const search = data.management?.transferMarket?.search;
      if (search) {
        const p = search.pagination;
        setStatus(`Найдено ${p.totalResults} игроков, показаны ${p.shownFrom}–${p.shownTo}. ${search.sort.applied ? "Сортировка применена." : "Одна страница: сортировка не применялась."} JSON скачан.`, "ok");
      } else if (data.management?.transferMarket?.myBids) {
        setStatus(`Мои заявки: ${data.management.transferMarket.myBids.bids.length}. JSON скачан.`, "ok");
      } else setStatus(`Готово: ${Math.round(size/1024)} KB. JSON скачан.`, "ok");
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

      <label class="vfl-club-data" title="Только для моей команды">
        <input id="vfl-management" type="checkbox">
        <span>Менеджмент команды<small>Тренировки, скаутинг и физическая форма<br>Только для моей команды</small></span>
      </label>

      <button data-action="team">
        <b>Собрать мою команду</b>
        <small>managerzone + N матчей${""}</small>
      </button>

      <button data-action="opponent">
        <b>Собрать ближайшего соперника</b>
        <small>roster + N матчей</small>
      </button>

      <details class="vfl-market">
        <summary>Трансферный рынок</summary>
        <div class="vfl-market-row"><label for="vfl-market-position">Позиция</label><select id="vfl-market-position"><option value="">Не важно</option>${TRANSFER_POSITIONS.map(p => `<option value="${p}">${p}</option>`).join("")}</select></div>
        ${[["age","Возраст"],["price","Цена, тыс."],["strength","Сила"],["askingPercent","% номинала"]].map(([key, label]) => `<div class="vfl-market-row"><span>${label}</span><input id="vfl-market-${key}-min" type="text" inputmode="numeric" placeholder="от" aria-label="${label}: минимум"><span>—</span><input id="vfl-market-${key}-max" type="text" inputmode="numeric" placeholder="до" aria-label="${label}: максимум"></div>`).join("")}
        <div class="vfl-market-row"><label for="vfl-market-style">Стиль</label><select id="vfl-market-style"><option value="">Не важно</option>${TRANSFER_STYLES.map((label,i) => `<option value="${i+1}">${label}</option>`).join("")}</select></div>
        <div class="vfl-market-row"><label for="vfl-market-sort">Сортировка</label><select id="vfl-market-sort"><option value="strength">По силе</option><option value="price">По цене</option><option value="specials">По спецвозможностям</option><option value="age">По возрасту</option></select></div>
        <small>Только первая страница, до 50 игроков. Сортировка применяется при нескольких страницах.</small>
        <div class="vfl-market-buttons"><button data-action="market">Найти игроков</button><button data-action="bids">Мои заявки</button></div>
      </details>

      <div id="vfl-assistant-status">Открой managerzone.php</div>
      <div class="vfl-assistant-note">
        Deep: свои игроки — профиль, статистика и контракт; соперник — только профиль. Последние матчи игроков ограничены выбранным числом.
        Экспорт компактнее: без полного body/tables и без script/style.
      </div>
    </div>
  `;

  document.body.appendChild(panel);
  panel.querySelectorAll("[data-action]").forEach(btn => btn.addEventListener("click", () => run(btn.dataset.action)));
  panel.querySelector("#vfl-assistant-close").addEventListener("click", () => panel.remove());
})();
