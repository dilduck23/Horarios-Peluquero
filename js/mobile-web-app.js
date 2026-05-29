(function (window) {
    const db = window.StaffPlanner.db;
    const tables = window.StaffPlanner.tables;

    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const monthShort = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const weekLabels = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const dayNamesFull = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

    const storeLegendItems = [
        ['C', '#FACE68', 'Rumichaca entre Sucre y Colon', 'https://maps.app.goo.gl/GFjNtPVYuY8TQZvm9'],
        ['V', '#D2DCB6', 'Velez y Garcia Aviles', 'https://maps.app.goo.gl/vAzf9j127ZpVJq2XA'],
        ['S', '#5A9CB5', 'Lorenzo de Garaycoa entre Luque y Aguirre', 'https://maps.app.goo.gl/w1PL8sSKujL5LoFAA'],
        ['P', '#A7AAE1', 'Portete y la 19', 'https://maps.app.goo.gl/MGewoEzfABcrqLPk9'],
        ['T', '#FA6868', 'C.C. Plaza Tia Bastion', 'https://maps.app.goo.gl/BATM7wJ7jznPwcaq6'],
        ['J', '#DEE791', 'La Joya C.C. Plaza Diamante', 'https://maps.app.goo.gl/W1rf9nBUo4w4y4hu9'],
        ['M', '#2FA08E', 'Mapasingue Oeste C.C. Plaza Tia El Trebol', 'https://maps.app.goo.gl/nGmWBBGKC8mDEYLe9']
    ];
    const promoterAliases = [
        { brand: 'DMUJERES', from: 'SILVANA', to: 'SILVIA' }
    ];
    const desktopMediaQuery = '(min-width: 981px)';
    let layoutMode = 'mobile';
    let layoutPreference = 'auto';

    function navItems() {
        return [
            ['planner', 'index.html', 'space_dashboard', 'Planificar'],
            ['store', 'calendario-tienda.html', 'storefront', 'Tienda'],
            ['internal', 'personal.html', 'work_outline', 'Interno'],
            ['reports', 'reportes.html', 'report_problem', 'Reportes'],
            ['nav', 'navegacion.html', 'apps', 'Navegación']
        ];
    }

    function detectedLayoutMode() {
        if (typeof window.matchMedia === 'function') {
            return window.matchMedia(desktopMediaQuery).matches ? 'desktop' : 'mobile';
        }
        return window.innerWidth > 980 ? 'desktop' : 'mobile';
    }

    function resolveLayoutMode(layout) {
        if (layout === 'desktop' || layout === 'mobile') return layout;
        return detectedLayoutMode();
    }

    function setLayoutPreference(layout) {
        layoutPreference = layout === 'desktop' || layout === 'mobile' ? layout : 'auto';
        layoutMode = resolveLayoutMode(layoutPreference);
    }

    function refreshResponsiveLayout() {
        if (layoutPreference !== 'auto') {
            updateDesktopScrollFrames();
            return;
        }
        const nextLayout = resolveLayoutMode('auto');
        if (nextLayout === layoutMode) {
            updateDesktopScrollFrames();
            return;
        }
        layoutMode = nextLayout;
        if (window.mobileApp?.render) {
            window.mobileApp.render();
        }
    }

    function h(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function asText(value, fallback = '') {
        if (value === null || value === undefined || value === '') return fallback;
        return String(value);
    }

    function asInt(value, fallback = 0) {
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function byId(rows, id) {
        const target = asInt(id, NaN);
        return rows.find((row) => asInt(row.id, NaN) === target) || null;
    }

    function dateKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function todayKeyInGuayaquil() {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Guayaquil',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).formatToParts(new Date());
        const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
        return `${values.year}-${values.month}-${values.day}`;
    }

    function timeInGuayaquil(value) {
        if (!value) return '';
        try {
            return new Intl.DateTimeFormat('es-EC', {
                timeZone: 'America/Guayaquil',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).format(new Date(value));
        } catch (error) {
            return asText(value).slice(11, 16);
        }
    }

    function parseDate(value) {
        if (!value) return null;
        const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
        if (!year || !month || !day) return null;
        return new Date(year, month - 1, day);
    }

    function monthStart(date) {
        return new Date(date.getFullYear(), date.getMonth(), 1);
    }

    function monthEnd(date) {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0);
    }

    function prettyDate(date) {
        return `${dayNamesFull[date.getDay()]}, ${date.getDate()} ${monthShort[date.getMonth()]} ${date.getFullYear()}`;
    }

    function monthLabel(date) {
        return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    }

    function isLightColor(hexColor) {
        const hex = asText(hexColor, '#ffffff').replace('#', '');
        if (hex.length < 6) return true;
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return ((r * 299 + g * 587 + b * 114) / 1000) > 155;
    }

    function colorFromStore(store, fallback = '#0E9F8F') {
        return asText(store?.color_hex, fallback);
    }

    function activePromoter(person) {
        return person && person.Habilitado !== false;
    }

    function activeInternal(person) {
        return person && person.Habilitado !== false && person.habilitado !== false;
    }

    function initials(name, count = 2) {
        return asText(name, 'N')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map((part) => part[0])
            .join('')
            .slice(0, count)
            .toUpperCase();
    }

    function normalizeSearch(value) {
        return asText(value)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();
    }

    function promoterDisplayName(person) {
        const brand = normalizeSearch(person?.Marca);
        const name = normalizeSearch(person?.nombre_completo);
        const alias = promoterAliases.find((item) => normalizeSearch(item.brand) === brand && normalizeSearch(item.from) === name);
        return alias ? alias.to : asText(person?.nombre_completo, 'Sin nombre');
    }

    function promoterCanonicalKey(person) {
        return `${normalizeSearch(person?.Marca)}|${normalizeSearch(promoterDisplayName(person))}`;
    }

    function promoterIds(person) {
        const ids = person?._ids?.length ? person._ids : [asInt(person?.id)];
        const primary = asInt(person?.id);
        return primary ? [primary, ...ids.filter((id) => id !== primary)] : ids;
    }

    function promoterMatchesRow(person, row) {
        return promoterIds(person).includes(asInt(row.impulsadora_id));
    }

    function betterPromoter(a, b, preferredId = null) {
        if (!a) return b;
        if (preferredId && asInt(b.id) === preferredId) return b;
        if (preferredId && asInt(a.id) === preferredId) return a;
        const aVendor = asText(a.idVendedor);
        const bVendor = asText(b.idVendedor);
        if (!!aVendor !== !!bVendor) return bVendor ? b : a;
        if (activePromoter(a) !== activePromoter(b)) return activePromoter(b) ? b : a;
        return asInt(b.id) < asInt(a.id) ? b : a;
    }

    function mergePromoterOptions(promoters, preferredId = null) {
        const groups = new Map();
        promoters.forEach((person) => {
            const key = promoterCanonicalKey(person);
            const current = groups.get(key);
            const best = betterPromoter(current?.best, person, preferredId);
            const ids = current?.ids || [];
            if (!ids.includes(asInt(person.id))) ids.push(asInt(person.id));
            groups.set(key, { best, ids });
        });
        return [...groups.values()]
            .map((item) => ({ ...item.best, nombre_completo: promoterDisplayName(item.best), _ids: item.ids }))
            .sort((a, b) => asText(a.nombre_completo).localeCompare(asText(b.nombre_completo)));
    }

    function promoterSearchLabel(person) {
        return `${promoterDisplayName(person)} - ${asText(person?.Marca, 'Sin marca')}`;
    }

    function resolvePromoterSearch(value, promoters) {
        const needle = normalizeSearch(value);
        if (!needle) return { id: 0, state: 'empty' };
        const exact = promoters.find((person) => normalizeSearch(promoterSearchLabel(person)) === needle);
        if (exact) return { id: asInt(exact.id), state: 'ok' };
        const matches = promoters.filter((person) => {
            const label = normalizeSearch(promoterSearchLabel(person));
            return label.includes(needle)
                || normalizeSearch(person?.nombre_completo).includes(needle)
                || normalizeSearch(person?.Marca).includes(needle);
        });
        if (matches.length === 1) return { id: asInt(matches[0].id), state: 'ok' };
        return { id: 0, state: matches.length > 1 ? 'ambiguous' : 'missing' };
    }

    function storePickerColors(store) {
        if (!store) return { background: '#ffffff', color: '#111827', border: '#e8e2dd' };
        const background = colorFromStore(store, '#ffffff');
        return {
            background,
            color: isLightColor(background) ? '#111827' : '#ffffff',
            border: background
        };
    }

    function storePickerStyle(store) {
        const colors = storePickerColors(store);
        return `background:${h(colors.background)} !important;color:${h(colors.color)} !important;border-color:${h(colors.border)} !important;font-weight:900;`;
    }

    function storeBadge(store, size = 48) {
        const color = colorFromStore(store);
        const alias = h(asText(store?.alias_tienda, 'T'));
        const textColor = isLightColor(color) ? '#111827' : '#ffffff';
        return `<span class="store-badge-ui" style="width:${size}px;height:${size}px;background:${h(color)};color:${textColor};font-size:${Math.max(11, Math.round(size / 3.2))}px">${alias}</span>`;
    }

    function miniChip(label, color = '#E85D75') {
        return `<span class="mini-chip"><span class="mini-chip-dot" style="background:${h(color)}"></span>${h(label)}</span>`;
    }

    function emptyState(icon, title, message) {
        return `<div class="empty-state"><span class="material-icons">${h(icon)}</span><strong>${h(title)}</strong><p>${h(message)}</p></div>`;
    }

    function loadingState() {
        return `<div class="p-4 space-y-3"><div class="skeleton h-20 rounded-xl"></div><div class="skeleton h-20 rounded-xl"></div><div class="skeleton h-20 rounded-xl"></div></div>`;
    }

    async function rows(query) {
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    function isMissingAttendanceTable(error) {
        const message = asText(error?.message || error?.details || error);
        return error?.code === '42P01' || error?.code === 'PGRST205' || message.includes('Tiendas_Asistencia');
    }

    async function copyText(text) {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return;
        }
        const input = document.createElement('textarea');
        input.value = text;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
    }

    function session() {
        const roleId = window.StaffPlanner.getRoleId();
        return {
            roleId,
            roleName: sessionStorage.getItem('staffPlannerRoleName') || 'Usuario',
            user: JSON.parse(sessionStorage.getItem('staffPlannerUser') || '{}'),
            storeId: window.StaffPlanner.getTiendaId() || null,
            isAdmin: roleId === 1,
            isManager: roleId === 1 || roleId === 2,
            isStoreUser: roleId === 3
        };
    }

    function ensureAdminAuth() {
        if (sessionStorage.getItem('staffPlannerAuth') !== 'true' || !window.StaffPlanner.canAccessAdminViews()) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    function nav(active) {
        const items = navItems();
        if (layoutMode === 'desktop') {
            return `
                <nav class="desktop-nav">
                    ${items.map(([key, href, icon, label]) => `
                        <a href="${href}" class="desktop-nav-item ${key === active ? 'active' : ''}">
                            <span class="material-icons">${icon}</span>
                            <span>${label}</span>
                        </a>
                    `).join('')}
                </nav>`;
        }
        return `
            <nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-3 py-2 z-50 nav-safe">
                <div class="flex justify-around items-center">
                    ${items.map(([key, href, icon, label]) => `
                        <a href="${href}" class="nav-item ${key === active ? 'active' : ''} flex flex-col items-center gap-1 p-2">
                            <span class="nav-icon w-10 h-10 rounded-xl flex items-center justify-center"><span class="material-icons">${icon}</span></span>
                            <span class="text-[10px] font-semibold">${label}</span>
                        </a>
                    `).join('')}
                </div>
            </nav>`;
    }

    function shell(active, title, subtitle, actions, content) {
        if (layoutMode === 'desktop') {
            const current = navItems().find((item) => item[0] === active);
            const user = session();
            document.getElementById('mainApp').innerHTML = `
                <div class="desktop-app">
                    <aside class="desktop-sidebar">
                        <div class="desktop-brand">
                            <span>Novepsa Planner</span>
                        </div>
                        ${nav(active)}
                        <div class="desktop-user-card">
                            <span class="store-badge-ui" style="width:42px;height:42px;background:#111827;color:#fff">${h(initials(asText(user.user?.email, 'U'), 1))}</span>
                            <span class="min-w-0">
                                <strong>${h(user.roleName)}</strong>
                                <small>${h(asText(user.user?.email, 'Usuario'))}</small>
                            </span>
                        </div>
                    </aside>
                    <section class="desktop-main">
                        <header class="desktop-topbar">
                            <div class="desktop-title-block">
                                <div class="desktop-breadcrumb">${h(current?.[3] || title)}</div>
                                <h1>${h(title)}</h1>
                                ${subtitle ? `<p>${h(subtitle)}</p>` : ''}
                            </div>
                            <div class="planner-actions">${actions || ''}</div>
                        </header>
                        <main class="desktop-content">${content}</main>
                    </section>
                </div>`;
            updateDesktopScrollFrames();
            return;
        }
        document.getElementById('mainApp').innerHTML = `
            <div class="planner-page">
                <header class="planner-topbar">
                    <div class="planner-topbar-title">
                        <h1 class="app-page-title">${h(title)}</h1>
                        ${subtitle ? `<p class="app-page-subtitle">${h(subtitle)}</p>` : ''}
                    </div>
                    <div class="planner-actions">${actions || ''}</div>
                </header>
                <main class="planner-content">${content}</main>
                ${nav(active)}
            </div>`;
    }

    function iconButton(icon, handler, title = '', active = false, tone = '') {
        const label = layoutMode === 'desktop' && title ? `<span class="planner-btn-label">${h(title)}</span>` : '';
        return `<button type="button" class="planner-icon-btn ${tone ? h(tone) : ''} ${active ? 'active' : ''}" title="${h(title)}" aria-label="${h(title || icon)}" onclick="${handler}"><span class="material-icons">${h(icon)}</span>${label}</button>`;
    }

    function syncScrollFrame(frame) {
        const track = frame?.querySelector('.desktop-scroll-track');
        if (!track) return;
        const canScroll = track.scrollWidth > track.clientWidth + 4;
        frame.classList.toggle('can-scroll', canScroll);
        frame.classList.toggle('at-start', track.scrollLeft <= 2);
        frame.classList.toggle('at-end', track.scrollLeft + track.clientWidth >= track.scrollWidth - 2);
    }

    function updateDesktopScrollFrames() {
        if (layoutMode !== 'desktop') return;
        const schedule = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : ((callback) => setTimeout(callback, 0));
        schedule(() => {
            document.querySelectorAll('.desktop-scroll-frame').forEach((frame) => {
                const track = frame.querySelector('.desktop-scroll-track');
                if (!track) return;
                track.onscroll = () => syncScrollFrame(frame);
                syncScrollFrame(frame);
            });
        });
    }

    function restoreSearchFocus(input, selectionStart, selectionEnd) {
        if (!input) return;
        const key = input.dataset?.searchInput || '';
        const selector = key ? `[data-search-input="${key}"]` : '[data-search-input]';
        const schedule = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : ((callback) => setTimeout(callback, 0));
        schedule(() => {
            const nextInput = document.querySelector(selector);
            if (!nextInput) return;
            nextInput.focus({ preventScroll: true });
            try {
                const start = Number.isFinite(selectionStart) ? selectionStart : nextInput.value.length;
                const end = Number.isFinite(selectionEnd) ? selectionEnd : start;
                nextInput.setSelectionRange(start, end);
            } catch (error) {
                // Some input types do not support cursor ranges.
            }
        });
    }

    function scrollFrame(trackClass, content, label) {
        if (layoutMode !== 'desktop') return `<div class="${trackClass}">${content}</div>`;
        return `
            <div class="desktop-scroll-frame at-start">
                <button type="button" class="desktop-scroll-arrow left" aria-label="Desplazar ${h(label)} a la izquierda" onclick="mobileApp.scrollBlock(this, -1)">
                    <span class="material-icons">chevron_left</span>
                </button>
                <div class="${trackClass} desktop-scroll-track">${content}</div>
                <button type="button" class="desktop-scroll-arrow right" aria-label="Desplazar ${h(label)} a la derecha" onclick="mobileApp.scrollBlock(this, 1)">
                    <span class="material-icons">chevron_right</span>
                </button>
            </div>`;
    }

    function monthControls(date, prevHandler, nextHandler) {
        return `
            <div class="month-controls">
                <button class="month-arrow" onclick="${prevHandler}"><span class="material-icons">chevron_left</span></button>
                <div class="month-title">${h(monthLabel(date))}</div>
                <button class="month-arrow" onclick="${nextHandler}"><span class="material-icons">chevron_right</span></button>
            </div>`;
    }

    function dateStrip(selected, handlerPrefix) {
        const today = new Date();
        const days = [];
        for (let i = -2; i <= 4; i += 1) {
            days.push(new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));
        }
        const content = `
            ${days.map((date) => {
                const active = dateKey(date) === dateKey(selected);
                return `<button class="date-chip ${active ? 'active' : ''}" onclick="${handlerPrefix}('${dateKey(date)}')"><span>${h(weekLabels[date.getDay()])}</span><strong>${date.getDate()}</strong></button>`;
            }).join('')}
            <button class="date-chip" onclick="${handlerPrefix}('__picker__')"><span class="material-icons">calendar_month</span></button>`;
        return scrollFrame('date-strip', content, 'fechas');
    }

    function groupByDay(rowsInMonth, date) {
        const grouped = {};
        rowsInMonth.forEach((row) => {
            const parsed = parseDate(row.fecha);
            if (!parsed || parsed.getFullYear() !== date.getFullYear() || parsed.getMonth() !== date.getMonth()) return;
            const day = parsed.getDate();
            if (!grouped[day]) grouped[day] = [];
            grouped[day].push(row);
        });
        return grouped;
    }

    function calendarBoard(options) {
        const selected = options.selected;
        const daysInMonth = monthEnd(selected).getDate();
        const firstDay = monthStart(selected);
        const leadingEmpty = firstDay.getDay();
        const totalCells = leadingEmpty + daysInMonth;
        const trailingEmpty = (7 - (totalCells % 7)) % 7;
        const cellCount = totalCells + trailingEmpty;
        const grouped = groupByDay(options.rows, selected);
        const peopleCount = new Set(options.rows.map(options.personId)).size;
        const storeCount = new Set(options.rows.map((row) => asInt(row.tienda_id))).size;
        let cells = '';

        for (let index = 0; index < cellCount; index += 1) {
            const day = index - leadingEmpty + 1;
            if (day < 1 || day > daysInMonth) {
                cells += '<div class="calendar-cell blank"></div>';
                continue;
            }
            const date = new Date(selected.getFullYear(), selected.getMonth(), day);
            const key = dateKey(date);
            const rowsForDay = grouped[day] || [];
            const isToday = key === dateKey(new Date());
            cells += `
                <button class="calendar-cell ${isToday ? 'today' : ''}" onclick="${options.dayHandler}('${key}')">
                    <span class="calendar-day-number">${day}</span>
                    ${rowsForDay.length === 0 ? '<span class="calendar-empty-mark">-</span>' : options.cellContent(rowsForDay)}
                    ${rowsForDay.length ? `<span class="calendar-cell-count">${rowsForDay.length}</span>` : ''}
                </button>`;
        }

        return `
            <section class="calendar-card app-card">
                <div class="calendar-card-header">
                    ${options.badge || ''}
                    <div class="flex-1 min-w-0">
                        <div class="calendar-title">${h(monthNames[selected.getMonth()].toUpperCase())}</div>
                        <div class="calendar-subtitle">${h(options.subtitle)}</div>
                    </div>
                    <div class="flex flex-col items-end gap-1">
                        ${miniChip(`${options.rows.length} ${options.countLabel}`, '#E85D75')}
                        ${miniChip(options.peopleLabel(peopleCount, storeCount), '#0E9F8F')}
                    </div>
                </div>
                <div class="calendar-week">${weekLabels.map((label) => `<div>${label}</div>`).join('')}</div>
                <div class="calendar-grid">${cells}</div>
            </section>`;
    }

    function agendaList(options) {
        const grouped = groupByDay(options.rows, options.selected);
        const daysInMonth = monthEnd(options.selected).getDate();
        const today = new Date();
        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const days = [];
        for (let day = 1; day <= daysInMonth; day += 1) {
            const date = new Date(options.selected.getFullYear(), options.selected.getMonth(), day);
            if (date < todayOnly) continue;
            if (options.onlyAssigned && !(grouped[day] || []).length) continue;
            days.push(date);
        }
        if (!days.length) {
            return `<section class="agenda-list"><h2>Listado desde hoy</h2>${emptyState(options.emptyIcon, options.emptyTitle, options.emptyMessage)}</section>`;
        }
        return `
            <section class="agenda-list">
                <h2>Listado desde hoy</h2>
                ${days.map((date) => {
                    const dayRows = grouped[date.getDate()] || [];
                    return `
                        <article class="agenda-day-card app-card">
                            <div class="agenda-day-head">
                                <div class="agenda-day-box">${date.getDate()}</div>
                                <div class="flex-1 min-w-0">
                                    <div class="app-list-title">${h(dayNamesFull[date.getDay()])}</div>
                                    <div class="app-list-subtitle">${h(options.daySubtitle(dayRows.length))}</div>
                                </div>
                                ${options.addHandler ? `<button class="planner-icon-btn" onclick="${options.addHandler}('${dateKey(date)}')"><span class="material-icons">add_circle_outline</span></button>` : ''}
                            </div>
                            ${dayRows.length ? dayRows.map(options.row).join('') : '<p class="app-list-subtitle">Sin personal asignado.</p>'}
                        </article>`;
                }).join('')}
            </section>`;
    }

    function statCard(label, value, icon, color = '#E85D75') {
        return `<article class="stat-card-ui app-card"><span class="material-icons" style="color:${h(color)}">${h(icon)}</span><div class="stat-card-value">${h(value)}</div><div class="stat-card-label">${h(label)}</div></article>`;
    }

    function progressBar(value, color) {
        const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
        return `<div class="h-2 rounded-full bg-[#e9e2dd] overflow-hidden"><div class="h-full rounded-full" style="width:${pct}%;background:${h(color)}"></div></div>`;
    }

    function internalTypeColor(type) {
        switch (asText(type).toUpperCase()) {
            case 'VACACIONES': return '#F59E0B';
            case 'PERMISO': return '#7C3AED';
            case 'LICENCIA': return '#2563EB';
            default: return '#0E9F8F';
        }
    }

    class BaseView {
        constructor(active) {
            this.active = active;
            this.session = session();
        }

        async init() {
            if (!ensureAdminAuth()) return;
            window.mobileApp = this;
            this.renderLoading();
            await this.load();
            this.render();
        }

        renderLoading() {
            shell(this.active, 'Novepsa Planner', 'Cargando...', iconButton('refresh', 'mobileApp.reload()'), loadingState());
        }

        async reload() {
            await this.load();
            this.render();
        }

        async loadBase() {
            const [stores, promoters, categories, internalStaff] = await Promise.all([
                rows(db.from(tables.stores).select('*').order('nombre_display')),
                rows(db.from(tables.impulsadoras).select('*')),
                rows(db.from(tables.categories).select('*')),
                rows(db.from(tables.internalStaff).select('*').order('nombre_completo'))
            ]);
            this.stores = stores;
            this.promoters = promoters;
            this.categories = categories;
            this.internalStaff = internalStaff;
        }

        async promoterAssignmentsForKey(key) {
            let query = db.from(tables.schedule).select('*').eq('fecha', key);
            if (this.session.isStoreUser && this.session.storeId) query = query.eq('tienda_id', this.session.storeId);
            return rows(query);
        }

        async promoterAssignments(date) {
            return this.promoterAssignmentsForKey(dateKey(date));
        }

        async attendanceForKey(key) {
            if (!tables.attendance) return [];
            try {
                let query = db.from(tables.attendance).select('*').eq('fecha', key);
                if (this.session.isStoreUser && this.session.storeId) query = query.eq('tienda_id', this.session.storeId);
                return await rows(query);
            } catch (error) {
                if (isMissingAttendanceTable(error)) return [];
                throw error;
            }
        }

        async internalAssignments(date) {
            let query = db.from(tables.internalSchedule).select('*').eq('fecha', dateKey(date));
            if (this.session.isStoreUser && this.session.storeId) query = query.eq('tienda_id', this.session.storeId);
            return rows(query);
        }

        async monthlyPromoterAssignments(date) {
            let query = db.from(tables.schedule)
                .select('*')
                .gte('fecha', dateKey(monthStart(date)))
                .lte('fecha', dateKey(monthEnd(date)))
                .order('fecha');
            if (this.session.isStoreUser && this.session.storeId) query = query.eq('tienda_id', this.session.storeId);
            return rows(query);
        }

        async monthlyInternalAssignments(date) {
            let query = db.from(tables.internalSchedule)
                .select('*')
                .gte('fecha', dateKey(monthStart(date)))
                .lte('fecha', dateKey(monthEnd(date)))
                .order('fecha');
            if (this.session.isStoreUser && this.session.storeId) query = query.eq('tienda_id', this.session.storeId);
            return rows(query);
        }

        showProfile() {
            window.location.href = 'navegacion.html';
        }

        logout() {
            sessionStorage.clear();
            window.location.href = 'login.html';
        }

        scrollBlock(button, direction) {
            const frame = button?.closest('.desktop-scroll-frame');
            const track = frame?.querySelector('.desktop-scroll-track');
            if (!track) return;
            const distance = Math.max(260, Math.round(track.clientWidth * 0.72));
            track.scrollBy({ left: direction * distance, behavior: 'smooth' });
            setTimeout(() => syncScrollFrame(frame), 260);
        }

        paintStorePicker(select) {
            if (!select) return;
            const store = byId(this.stores || [], select.value);
            const colors = storePickerColors(store);
            select.style.backgroundColor = colors.background;
            select.style.color = colors.color;
            select.style.borderColor = colors.border;
            select.style.fontWeight = store ? '900' : '700';
        }

        updateSearch(value, input) {
            const selectionStart = input?.selectionStart;
            const selectionEnd = input?.selectionEnd;
            this.search = value;
            this.render();
            restoreSearchFocus(input, selectionStart, selectionEnd);
        }
    }

    class PlannerView extends BaseView {
        constructor() {
            super('planner');
            this.selected = new Date();
            this.monthMode = false;
            this.sideMode = false;
            this.vendorMode = false;
            this.summaryMode = false;
            this.onlyAssigned = false;
            this.filter = 'all';
            this.search = '';
            this.zoneFilter = '';
            this.selectedPromoterId = null;
            this.focusedStoreIds = this.session.isStoreUser && this.session.storeId ? [this.session.storeId] : [];
            this.stores = [];
            this.promoters = [];
            this.categories = [];
            this.internalStaff = [];
            this.promoterRows = [];
            this.internalRows = [];
            this.monthlyRows = [];
        }

        async load() {
            await this.loadBase();
            const [promoterRows, internalRows, monthlyRows] = await Promise.all([
                this.promoterAssignments(this.selected),
                this.internalAssignments(this.selected),
                this.monthlyPromoterAssignments(this.selected)
            ]);
            this.promoterRows = promoterRows;
            this.internalRows = internalRows;
            this.monthlyRows = monthlyRows;
        }

        render() {
            if (this.vendorMode) return this.renderVendorView();
            if (this.sideMode) return this.renderSideView();
            if (this.monthMode) return this.renderMonthly();
            const actions = this.plannerActions('daily');
            shell('planner', 'Planificador', prettyDate(this.selected), actions, this.dailyContent());
        }

        plannerActions(activeView) {
            if (layoutMode !== 'desktop') {
                return [
                    iconButton('today', 'mobileApp.showDailyMode()', 'Vista diaria', activeView === 'daily'),
                    iconButton('badge', 'mobileApp.showVendorMode()', 'Por vendedor', activeView === 'vendor'),
                    iconButton('table_chart', 'mobileApp.showMonthMode()', 'Calendario mensual', activeView === 'month'),
                    iconButton('refresh', 'mobileApp.reload()', 'Actualizar')
                ].join('');
            }
            return [
                iconButton('today', 'mobileApp.showDailyMode()', 'Vista diaria', activeView === 'daily'),
                iconButton('view_week', 'mobileApp.showSideMode()', 'Vista lateral', activeView === 'side'),
                iconButton('table_chart', 'mobileApp.showMonthMode()', 'Calendario mensual', activeView === 'month'),
                iconButton('badge', 'mobileApp.showVendorMode()', 'Por vendedor', activeView === 'vendor'),
                iconButton('refresh', 'mobileApp.reload()', 'Actualizar')
            ].join('');
        }

        dailyContent() {
            const entries = this.visibleEntries();
            const storeIds = new Set(entries.map((entry) => entry.storeId));
            const hasFocus = this.hasStoreFocus();
            const capacityStores = hasFocus ? this.visibleStores().filter((store) => this.isStoreFocused(asInt(store.id))) : this.visibleStores();
            const capacityAlerts = capacityStores.filter((store) => this.capacityFor(store).isFull).length;
            const promoterCount = entries.filter((entry) => entry.kind === 'impulso').length;
            const internalCount = entries.filter((entry) => entry.kind === 'interno').length;
            return `
                ${dateStrip(this.selected, 'mobileApp.selectDate')}
                ${this.hero(promoterCount, internalCount, storeIds.size, capacityAlerts)}
                ${this.capacityRail()}
                ${this.dailyFilters()}
                ${entries.length ? this.entrySections(entries) : emptyState(hasFocus ? 'filter_alt_off' : 'event_busy', 'Sin asignaciones visibles', hasFocus ? 'Quita el filtro de tienda o asigna personal aquí.' : 'Elige una fecha o crea una asignación.')}
                ${this.session.isManager ? '<button class="bottom-action" onclick="mobileApp.openAssignmentTypeSheet()">Asignar personal</button>' : ''}
            `;
        }

        hero(promoterCount, internalCount, storeCount, capacityAlerts) {
            const title = this.storeFilterLabel();
            return `
                <section class="planner-hero">
                    <div class="planner-hero-title"><span class="material-icons">route</span><span class="truncate">${h(title)}</span>${this.hasStoreFocus() && !this.session.isStoreUser ? '<button class="ml-auto" onclick="mobileApp.clearStoreFocus()"><span class="material-icons">close</span></button>' : ''}</div>
                    <div class="planner-metrics">
                        <div class="planner-metric"><div class="planner-metric-value">${promoterCount}</div><div class="planner-metric-label">Impulso</div></div>
                        <div class="planner-metric"><div class="planner-metric-value">${internalCount}</div><div class="planner-metric-label">Interno</div></div>
                        <div class="planner-metric"><div class="planner-metric-value">${storeCount}</div><div class="planner-metric-label">Tiendas</div></div>
                        <div class="planner-metric"><div class="planner-metric-value">${capacityAlerts}</div><div class="planner-metric-label">Cupos llenos</div></div>
                    </div>
                </section>`;
        }

        visibleStores() {
            const assigned = new Set([...this.promoterRows, ...this.internalRows].map((row) => asInt(row.tienda_id)));
            return this.stores
                .filter((store) => {
                    const id = asInt(store.id);
                    if (this.session.isStoreUser && this.session.storeId !== id) return false;
                    return store.activo !== false || assigned.has(id);
                })
                .sort((a, b) => {
                    const aFocusOrder = this.focusedStoreIds.indexOf(asInt(a.id));
                    const bFocusOrder = this.focusedStoreIds.indexOf(asInt(b.id));
                    const aSelected = aFocusOrder !== -1;
                    const bSelected = bFocusOrder !== -1;
                    if (aSelected !== bSelected) return aSelected ? -1 : 1;
                    if (aSelected && bSelected) return aFocusOrder - bFocusOrder;
                    const ca = this.capacityFor(a);
                    const cb = this.capacityFor(b);
                    if (ca.hasAny !== cb.hasAny) return ca.hasAny ? -1 : 1;
                    return asText(a.nombre_display).localeCompare(asText(b.nombre_display));
                });
        }

        capacityFor(store) {
            const storeId = asInt(store.id);
            const rowsForStore = this.promoterRows.filter((row) => asInt(row.tienda_id) === storeId);
            let zoneA = 0;
            let zoneB = 0;
            rowsForStore.forEach((row) => {
                const person = byId(this.promoters, row.impulsadora_id);
                const category = byId(this.categories, person?.idCategoria) || byId(this.categories, row.categoria_asignada_id);
                if (asInt(category?.id_zona) === 1) zoneA += 1;
                if (asInt(category?.id_zona) === 2) zoneB += 1;
            });
            const internalCount = this.internalRows.filter((row) => asInt(row.tienda_id) === storeId).length;
            const totalLimit = asInt(store.cupo_total);
            return {
                promoterCount: rowsForStore.length,
                internalCount,
                totalLimit,
                zoneA,
                zoneB,
                zoneALimit: asInt(store.cupo_zona_a),
                zoneBLimit: asInt(store.cupo_zona_b),
                hasAny: rowsForStore.length + internalCount > 0,
                isFull: totalLimit > 0 && rowsForStore.length >= totalLimit,
                isNearFull: totalLimit > 0 && rowsForStore.length >= totalLimit - 1
            };
        }

        capacityRail() {
            const stores = this.visibleStores();
            if (!stores.length) return '';
            const selectedCount = this.focusedStoreIds.length;
            return `
                <div class="section-title-row"><h2>Capacidad por tienda</h2>${selectedCount && !this.session.isStoreUser ? `<button class="mini-chip" onclick="mobileApp.clearStoreFocus()">Todas (${selectedCount})</button>` : ''}</div>
                ${scrollFrame('horizontal-scroll', stores.map((store) => this.capacityCard(store)).join(''), 'tiendas')}`;
        }

        capacityCard(store) {
            const capacity = this.capacityFor(store);
            const active = this.isStoreFocused(asInt(store.id));
            const progress = capacity.totalLimit > 0 ? capacity.promoterCount / capacity.totalLimit : 0;
            const progressColor = capacity.isFull ? '#DC2626' : capacity.isNearFull ? '#F97316' : '#0E9F8F';
            return `
                <button class="capacity-card app-card ${active ? 'active' : ''}" style="border-color:${active ? h(colorFromStore(store)) : '#e8e2dd'}" onclick="mobileApp.focusStore(${asInt(store.id)})">
                    <div class="flex items-center gap-2">
                        ${storeBadge(store, 40)}
                        <strong class="flex-1 truncate text-left">${h(asText(store.nombre_display))}</strong>
                        ${active ? '<span class="material-icons text-base">check_circle</span>' : ''}
                    </div>
                    <div class="flex items-end gap-2 mt-3"><span class="text-[22px] font-black">${capacity.totalLimit > 0 ? `${capacity.promoterCount}/${capacity.totalLimit}` : capacity.promoterCount}</span><span class="pb-1 text-sm font-bold text-[#756c65]">impulso</span></div>
                    <div class="my-2">${progressBar(progress, progressColor)}</div>
                    <div class="flex flex-wrap gap-1">
                        ${miniChip(`A ${capacity.zoneA}/${capacity.zoneALimit}`, '#E85D75')}
                        ${miniChip(`B ${capacity.zoneB}/${capacity.zoneBLimit}`, '#0E9F8F')}
                        ${miniChip(`Int ${capacity.internalCount}`, '#111827')}
                    </div>
                </button>`;
        }

        dailyFilters() {
            return `
                <section class="app-filter-stack">
                    <div class="app-segment-three">
                        <button class="${this.filter === 'all' ? 'active' : ''}" onclick="mobileApp.setFilter('all')">Todos</button>
                        <button class="${this.filter === 'impulso' ? 'active' : ''}" onclick="mobileApp.setFilter('impulso')">Impulso</button>
                        <button class="${this.filter === 'interno' ? 'active' : ''}" onclick="mobileApp.setFilter('interno')">Interno</button>
                    </div>
                    <label class="app-search"><span class="material-icons">search</span><input data-search-input="planner-daily" value="${h(this.search)}" oninput="mobileApp.setSearch(this.value, this)" placeholder="Buscar persona, marca o tienda"></label>
                </section>`;
        }

        visibleEntries() {
            const items = [];
            if (this.filter === 'all' || this.filter === 'impulso') {
                this.promoterRows.forEach((row) => {
                    const person = byId(this.promoters, row.impulsadora_id);
                    const store = byId(this.stores, row.tienda_id);
                    const category = byId(this.categories, person?.idCategoria) || byId(this.categories, row.categoria_asignada_id);
                    items.push({ kind: 'impulso', row, person, store, category, storeId: asInt(row.tienda_id) });
                });
            }
            if (this.filter === 'all' || this.filter === 'interno') {
                this.internalRows.forEach((row) => {
                    items.push({ kind: 'interno', row, person: byId(this.internalStaff, row.personal_id), store: byId(this.stores, row.tienda_id), storeId: asInt(row.tienda_id) });
                });
            }
            const needle = this.search.trim().toLowerCase();
            return items
                .filter((entry) => {
                    if (this.hasStoreFocus() && !this.focusedStoreIds.includes(entry.storeId)) return false;
                    if (!needle) return true;
                    const haystack = `${promoterDisplayName(entry.person)} ${asText(entry.person?.Marca)} ${asText(entry.store?.nombre_display)} ${asText(entry.row.tipo)}`.toLowerCase();
                    return haystack.includes(needle);
                })
                .sort((a, b) => {
                    const storeCompare = asText(a.store?.nombre_display).localeCompare(asText(b.store?.nombre_display));
                    if (storeCompare) return storeCompare;
                    if (a.kind !== b.kind) return a.kind === 'impulso' ? -1 : 1;
                    return promoterDisplayName(a.person).localeCompare(promoterDisplayName(b.person));
                });
        }

        entrySections(entries) {
            const grouped = {};
            entries.forEach((entry) => {
                if (!grouped[entry.storeId]) grouped[entry.storeId] = [];
                grouped[entry.storeId].push(entry);
            });
            return Object.keys(grouped)
                .sort((a, b) => asText(byId(this.stores, a)?.nombre_display).localeCompare(asText(byId(this.stores, b)?.nombre_display)))
                .map((storeId) => {
                    const store = byId(this.stores, storeId);
                    const group = grouped[storeId];
                    const impulse = group.filter((entry) => entry.kind === 'impulso').length;
                    const internal = group.length - impulse;
                    return `
                        <div class="store-section-header">
                            ${storeBadge(store, 34)}
                            <strong>${h(asText(store?.nombre_display, 'Tienda'))}</strong>
                            ${miniChip(`I ${impulse}`, '#E85D75')}
                            ${miniChip(`P ${internal}`, '#111827')}
                        </div>
                        ${group.map((entry) => this.entryTile(entry)).join('')}`;
                }).join('');
        }

        entryTile(entry) {
            const isPromoter = entry.kind === 'impulso';
            const color = isPromoter ? colorFromStore(entry.store) : internalTypeColor(entry.row.tipo);
            const subtitle = isPromoter
                ? `${asText(entry.person?.Marca, 'Sin marca')} - ${asText(entry.category?.descripcion, 'Sin cat.')}`
                : `${asText(entry.row.tipo, 'TRABAJO')} - ${asText(entry.store?.nombre_display, 'Tienda')}`;
            return `
                <button class="app-list-card app-card" onclick="mobileApp.openEntryActions('${entry.kind}', ${asInt(entry.row.id)})">
                    <div class="app-list-card-row">
                        ${isPromoter ? storeBadge(entry.store, 48) : `<span class="store-badge-ui" style="width:48px;height:48px;background:${color}2e;color:${color}"><span class="material-icons">inventory_2</span></span>`}
                        <span class="flex-1 min-w-0"><span class="app-list-title truncate block">${h(isPromoter ? promoterDisplayName(entry.person) : asText(entry.person?.nombre_completo, 'Personal'))}</span><span class="app-list-subtitle truncate block">${h(subtitle)}</span></span>
                        ${miniChip(isPromoter ? 'Impulso' : 'Interno', color)}
                        <span class="material-icons text-slate-400">chevron_right</span>
                    </div>
                </button>`;
        }

        renderMonthly() {
            const actions = this.plannerActions('month');
            shell('planner', 'Calendario', monthLabel(this.selected), actions, this.monthlyContent());
        }

        renderSideView() {
            const actions = this.plannerActions('side');
            shell('planner', 'Vista lateral', monthLabel(this.selected), actions, this.sideContent());
        }

        renderVendorView() {
            const person = this.selectedVendor();
            const actions = this.plannerActions('vendor');
            shell('planner', 'Horario por vendedor', person ? `${asText(person.Marca, 'Sin marca')} - ${promoterDisplayName(person)}` : monthLabel(this.selected), actions, this.vendorContent());
        }

        sideContent() {
            return `
                ${monthControls(this.selected, 'mobileApp.changeMonth(-1)', 'mobileApp.changeMonth(1)')}
                <section class="app-filter-stack">
                    <div class="app-segment-three">
                        <button class="${this.zoneFilter === '' ? 'active' : ''}" onclick="mobileApp.setZone('')">Todas</button>
                        <button class="${this.zoneFilter === '1' ? 'active' : ''}" onclick="mobileApp.setZone('1')">Zona A</button>
                        <button class="${this.zoneFilter === '2' ? 'active' : ''}" onclick="mobileApp.setZone('2')">Zona B</button>
                    </div>
                    <label class="app-search"><span class="material-icons">search</span><input data-search-input="planner-side" value="${h(this.search)}" oninput="mobileApp.setSearch(this.value, this)" placeholder="Buscar persona o marca"></label>
                    <button class="mini-chip justify-center" onclick="mobileApp.toggleOnlyAssigned()">${this.onlyAssigned ? 'Solo con turnos' : 'Todos'}</button>
                </section>
                ${this.sideTable()}
            `;
        }

        sidePeopleRows() {
            const visibleRows = this.visibleMonthRows();
            const rowPersonIds = new Set(visibleRows.map((row) => asInt(row.impulsadora_id)));
            const needle = this.search.trim().toLowerCase();
            const candidates = this.promoters
                .filter((person) => activePromoter(person) || rowPersonIds.has(asInt(person.id)))
                .filter((person) => {
                    const category = byId(this.categories, person?.idCategoria);
                    if (this.zoneFilter && String(asInt(category?.id_zona)) !== this.zoneFilter) return false;
                    if (this.onlyAssigned && !rowPersonIds.has(asInt(person.id))) return false;
                    if (!needle) return true;
                    return `${promoterDisplayName(person)} ${asText(person.Marca)} ${asText(category?.descripcion)}`.toLowerCase().includes(needle);
                });
            return mergePromoterOptions(candidates).sort((a, b) => {
                const zoneA = asInt(byId(this.categories, a?.idCategoria)?.id_zona, 99);
                const zoneB = asInt(byId(this.categories, b?.idCategoria)?.id_zona, 99);
                if (zoneA !== zoneB) return zoneA - zoneB;
                const brandCompare = asText(a.Marca).localeCompare(asText(b.Marca));
                if (brandCompare) return brandCompare;
                return asText(a.nombre_completo).localeCompare(asText(b.nombre_completo));
            });
        }

        sideTable() {
            const people = this.sidePeopleRows();
            if (!people.length) {
                return emptyState('table_view', 'Sin filas visibles', 'Ajusta los filtros para ver personal en la vista lateral.');
            }
            const daysInMonth = monthEnd(this.selected).getDate();
            const days = Array.from({ length: daysInMonth }, (_, index) => new Date(this.selected.getFullYear(), this.selected.getMonth(), index + 1));
            let lastZone = '';
            const rowsHtml = people.map((person) => {
                const category = byId(this.categories, person?.idCategoria);
                const zone = asInt(category?.id_zona);
                const zoneLabel = zone === 1 ? 'ZONA A' : zone === 2 ? 'ZONA B' : 'SIN ZONA';
                const zoneRow = zoneLabel !== lastZone ? `<tr class="side-zone-row"><th colspan="${daysInMonth + 2}">${h(zoneLabel)}</th></tr>` : '';
                lastZone = zoneLabel;
                return `${zoneRow}<tr>
                    <th class="side-sticky-col side-brand-col">${h(asText(person.Marca, 'Sin marca'))}</th>
                    <th class="side-sticky-col side-name-col">${h(asText(person.nombre_completo, 'Sin nombre'))}</th>
                    ${days.map((date) => this.sideDayCell(person, date)).join('')}
                </tr>`;
            }).join('');
            const table = `
                <table class="side-schedule-table">
                    <thead>
                        <tr>
                            <th class="side-sticky-col side-brand-col">Marca</th>
                            <th class="side-sticky-col side-name-col">Nombre</th>
                            ${days.map((date) => `<th class="side-day-head"><strong>${date.getDate()}</strong><span>${h(weekLabels[date.getDay()].slice(0, 1))}</span></th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>`;
            return `<section class="side-schedule-card app-card">${scrollFrame('side-schedule-scroll', table, 'vista lateral')}</section>`;
        }

        sideDayCell(person, date) {
            const key = dateKey(date);
            const personIds = promoterIds(person).join(',');
            const rowsForCell = this.visibleMonthRows().filter((row) => promoterMatchesRow(person, row) && asText(row.fecha) === key);
            if (!rowsForCell.length) {
                return `<td><button class="side-empty-cell" title="Asignar ${h(promoterDisplayName(person))}" onclick="mobileApp.openSideCell('${personIds}', '${key}')"></button></td>`;
            }
            const row = rowsForCell[0];
            const store = byId(this.stores, row.tienda_id);
            const color = colorFromStore(store);
            const textColor = isLightColor(color) ? '#111827' : '#ffffff';
            return `<td><button class="side-store-pill" style="background:${h(color)};color:${textColor}" title="${h(asText(store?.nombre_display, 'Tienda'))}" onclick="mobileApp.openSideCell('${personIds}', '${key}')">${h(asText(store?.alias_tienda, '?'))}${rowsForCell.length > 1 ? `<span>+${rowsForCell.length - 1}</span>` : ''}</button></td>`;
        }

        vendorContent() {
            const person = this.selectedVendor();
            const people = this.vendorPeopleRows();
            return `
                ${monthControls(this.selected, 'mobileApp.changeMonth(-1)', 'mobileApp.changeMonth(1)')}
                <section class="app-filter-stack vendor-filter-stack">
                    <label class="app-search"><span class="material-icons">search</span><input data-search-input="planner-vendor" value="${h(this.search)}" oninput="mobileApp.setSearch(this.value, this)" placeholder="Buscar vendedor, marca o codigo"></label>
                    <button class="mini-chip justify-center" onclick="mobileApp.toggleOnlyAssigned()">${this.onlyAssigned ? 'Solo con turnos' : 'Todos'}</button>
                </section>
                ${this.vendorSelector(people)}
                ${person ? this.vendorSchedule(person) : (people.length ? emptyState('badge', 'Elige un vendedor', 'Selecciona una persona para ver su horario mensual.') : '')}
            `;
        }

        vendorPeopleRows() {
            const rowPersonIds = new Set(this.monthlyRows.map((row) => asInt(row.impulsadora_id)));
            const selectedId = asInt(this.selectedPromoterId);
            const needle = normalizeSearch(this.search);
            const candidates = this.promoters
                .filter((person) => activePromoter(person) || rowPersonIds.has(asInt(person.id)))
                .filter((person) => {
                    const hasRows = rowPersonIds.has(asInt(person.id));
                    if (this.onlyAssigned && !hasRows) return false;
                    if (!needle) return true;
                    const category = byId(this.categories, person?.idCategoria);
                    return `${normalizeSearch(promoterDisplayName(person))} ${normalizeSearch(person.Marca)} ${normalizeSearch(person.idVendedor)} ${normalizeSearch(category?.descripcion)}`.includes(needle);
                });
            return mergePromoterOptions(candidates, selectedId).sort((a, b) => {
                const aSelected = promoterIds(a).includes(selectedId);
                const bSelected = promoterIds(b).includes(selectedId);
                if (aSelected !== bSelected) return aSelected ? -1 : 1;
                const countA = this.vendorScheduleRows(a).length;
                const countB = this.vendorScheduleRows(b).length;
                if (countA !== countB) return countB - countA;
                const brandCompare = asText(a.Marca).localeCompare(asText(b.Marca));
                if (brandCompare) return brandCompare;
                return promoterDisplayName(a).localeCompare(promoterDisplayName(b));
            });
        }

        vendorSelector(people) {
            if (!people.length) {
                return emptyState('person_search', 'Sin vendedores visibles', 'Ajusta la busqueda o muestra tambien personas sin turnos.');
            }
            return `
                <div class="section-title-row"><h2>Vendedores</h2>${this.selectedPromoterId ? `<button class="mini-chip" onclick="mobileApp.clearVendorSelection()">Limpiar</button>` : ''}</div>
                ${scrollFrame('vendor-scroll', people.map((person) => this.vendorCard(person)).join(''), 'vendedores')}`;
        }

        vendorCard(person) {
            const selected = promoterIds(person).includes(asInt(this.selectedPromoterId));
            const rowsForPerson = this.vendorScheduleRows(person);
            const storeCount = new Set(rowsForPerson.map((row) => asInt(row.tienda_id))).size;
            return `
                <button class="vendor-card app-card ${selected ? 'active' : ''}" onclick="mobileApp.selectVendor(${asInt(person.id)})">
                    <span class="vendor-avatar">${h(initials(promoterDisplayName(person), 1))}</span>
                    <span class="vendor-card-copy">
                        <strong>${h(promoterDisplayName(person))}</strong>
                        <small>${h(asText(person.Marca, 'Sin marca'))} ${asText(person.idVendedor) ? `- ${h(asText(person.idVendedor))}` : ''}</small>
                    </span>
                    <span class="vendor-card-stats">
                        ${miniChip(`${rowsForPerson.length} días`, '#E85D75')}
                        ${miniChip(`${storeCount} puntos`, '#0E9F8F')}
                    </span>
                    ${selected ? '<span class="material-icons vendor-card-check">check_circle</span>' : ''}
                </button>`;
        }

        selectedVendor() {
            const selectedId = asInt(this.selectedPromoterId);
            if (!selectedId) return null;
            const direct = byId(this.promoters, selectedId);
            if (!direct) return null;
            return mergePromoterOptions(this.promoters, selectedId)
                .find((person) => promoterIds(person).includes(selectedId)) || direct;
        }

        vendorScheduleRows(person) {
            if (!person) return [];
            return this.monthlyRows
                .filter((row) => promoterMatchesRow(person, row))
                .sort((a, b) => asText(a.fecha).localeCompare(asText(b.fecha)) || asText(byId(this.stores, a.tienda_id)?.nombre_display).localeCompare(asText(byId(this.stores, b.tienda_id)?.nombre_display)));
        }

        vendorSchedule(person) {
            const rowsForPerson = this.vendorScheduleRows(person);
            const storeCount = new Set(rowsForPerson.map((row) => asInt(row.tienda_id))).size;
            return `
                <section class="vendor-schedule-panel">
                    <div class="vendor-schedule-head app-card">
                        <span class="vendor-avatar large">${h(initials(promoterDisplayName(person)))}</span>
                        <span class="flex-1 min-w-0">
                            <strong>${h(promoterDisplayName(person))}</strong>
                            <small>${h(asText(person.Marca, 'Sin marca'))}${asText(person.idVendedor) ? ` - Codigo ${h(asText(person.idVendedor))}` : ''}</small>
                        </span>
                        ${this.session.isManager ? `<button class="planner-icon-btn" title="Asignar día" onclick="mobileApp.showPromoterFormForPerson(${asInt(person.id)}, '${dateKey(this.defaultVendorDate())}')"><span class="material-icons">edit_calendar</span></button>` : ''}
                    </div>
                    <div class="vendor-stat-row">
                        ${this.vendorStat('Dias asignados', rowsForPerson.length, 'event_available', '#E85D75')}
                        ${this.vendorStat('Puntos', storeCount, 'storefront', '#0E9F8F')}
                        ${this.vendorStat('Mes', monthShort[this.selected.getMonth()], 'calendar_month', '#111827')}
                    </div>
                    ${calendarBoard({
                        selected: this.selected,
                        rows: rowsForPerson,
                        subtitle: `${asText(person.Marca, 'Sin marca')} - ${promoterDisplayName(person)}`,
                        countLabel: 'días',
                        personId: () => asInt(person.id),
                        peopleLabel: () => `${storeCount} puntos`,
                        dayHandler: 'mobileApp.openVendorDay',
                        cellContent: (dayRows) => `<div>${dayRows.slice(0, 3).map((row) => this.vendorCalendarLabel(row)).join('')}${dayRows.length > 3 ? `<div class="text-[8px] font-black text-[#756c65] mt-1">+${dayRows.length - 3} más</div>` : ''}</div>`
                    })}
                </section>`;
        }

        vendorStat(label, value, icon, color) {
            return `<article class="vendor-stat"><span class="material-icons" style="color:${h(color)}">${h(icon)}</span><strong>${h(value)}</strong><small>${h(label)}</small></article>`;
        }

        vendorCalendarLabel(row) {
            const store = byId(this.stores, row.tienda_id);
            const color = colorFromStore(store, '#e8e2dd');
            const foreground = isLightColor(color) ? '#111827' : '#ffffff';
            return `<span class="vendor-calendar-label" style="background:${h(color)};color:${foreground}">${h(asText(store?.alias_tienda, 'T'))}</span>`;
        }

        defaultVendorDate() {
            const today = new Date();
            if (today.getFullYear() === this.selected.getFullYear() && today.getMonth() === this.selected.getMonth()) {
                return new Date(today.getFullYear(), today.getMonth(), today.getDate());
            }
            const person = this.selectedVendor();
            const firstRow = this.vendorScheduleRows(person)[0];
            return parseDate(firstRow?.fecha) || monthStart(this.selected);
        }

        monthlyContent() {
            const visible = this.visibleMonthRows();
            return `
                ${monthControls(this.selected, 'mobileApp.changeMonth(-1)', 'mobileApp.changeMonth(1)')}
                <section class="app-filter-stack">
                    <div class="app-segment">
                        <button class="${!this.summaryMode ? 'active' : ''}" onclick="mobileApp.setSummary(false)">Detalle</button>
                        <button class="${this.summaryMode ? 'active' : ''}" onclick="mobileApp.setSummary(true)">Resumen</button>
                    </div>
                    <div class="app-segment-three">
                        <button class="${this.zoneFilter === '' ? 'active' : ''}" onclick="mobileApp.setZone('')">Todas</button>
                        <button class="${this.zoneFilter === '1' ? 'active' : ''}" onclick="mobileApp.setZone('1')">Zona A</button>
                        <button class="${this.zoneFilter === '2' ? 'active' : ''}" onclick="mobileApp.setZone('2')">Zona B</button>
                    </div>
                    <label class="app-search"><span class="material-icons">search</span><input data-search-input="planner-monthly" value="${h(this.search)}" oninput="mobileApp.setSearch(this.value, this)" placeholder="Buscar nombre o marca"></label>
                    <button class="mini-chip justify-center" onclick="mobileApp.toggleOnlyAssigned()">${this.onlyAssigned ? 'Solo asignadas' : 'Mostrar vacías'}</button>
                </section>
                ${this.summaryMode ? this.monthlySummary() : calendarBoard({
                    selected: this.selected,
                    rows: visible,
                    subtitle: `${this.selected.getFullYear()} - Calendario mensual`,
                    countLabel: 'turnos',
                    personId: (row) => promoterCanonicalKey(byId(this.promoters, row.impulsadora_id) || { id: row.impulsadora_id }),
                    peopleLabel: (people, stores) => `${people} personas / ${stores} puntos`,
                    dayHandler: 'mobileApp.openMonthDay',
                    cellContent: (dayRows) => `<div class="store-dot-wrap">${dayRows.slice(0, 30).map((row) => `<span class="store-dot" style="background:${h(colorFromStore(byId(this.stores, row.tienda_id)))}"></span>`).join('')}${dayRows.length > 30 ? `<span class="text-[8px] font-black">+${dayRows.length - 30}</span>` : ''}</div>`
                })}
                ${!this.summaryMode ? agendaList({
                    selected: this.selected,
                    rows: visible,
                    onlyAssigned: this.onlyAssigned,
                    emptyIcon: 'calendar_month',
                    emptyTitle: 'Sin fechas pendientes',
                    emptyMessage: 'No hay días desde hoy que coincidan con los filtros.',
                    daySubtitle: (count) => `${count} ${count === 1 ? 'asignación' : 'asignaciones'}`,
                    addHandler: this.session.isManager ? 'mobileApp.openPromoterSheetForDate' : '',
                    row: (row) => this.promoterAgendaRow(row)
                }) : ''}
            `;
        }

        visibleMonthRows() {
            const needle = this.search.trim().toLowerCase();
            return this.monthlyRows
                .filter((row) => {
                    const person = byId(this.promoters, row.impulsadora_id);
                    const store = byId(this.stores, row.tienda_id);
                    const category = byId(this.categories, person?.idCategoria) || byId(this.categories, row.categoria_asignada_id);
                    if (!person) return false;
                    if (this.zoneFilter && String(asInt(category?.id_zona)) !== this.zoneFilter) return false;
                    if (!needle) return true;
                    return `${promoterDisplayName(person)} ${asText(person.Marca)} ${asText(store?.nombre_display)} ${asText(store?.alias_tienda)} ${asText(category?.descripcion)}`.toLowerCase().includes(needle);
                })
                .sort((a, b) => asText(a.fecha).localeCompare(asText(b.fecha)) || asText(byId(this.stores, a.tienda_id)?.nombre_display).localeCompare(asText(byId(this.stores, b.tienda_id)?.nombre_display)));
        }

        monthlySummary() {
            const daysInMonth = monthEnd(this.selected).getDate();
            const visibleStores = this.stores.filter((store) => store.activo !== false || this.monthlyRows.some((row) => asInt(row.tienda_id) === asInt(store.id)));
            const table = `
                <table class="min-w-max text-sm">
                    <thead><tr><th class="p-2 text-left">Tienda</th>${Array.from({ length: daysInMonth }, (_, i) => `<th class="p-2">${i + 1}</th>`).join('')}</tr></thead>
                    <tbody>
                        ${visibleStores.map((store) => `
                            <tr>
                                <td class="p-2 min-w-[190px]"><div class="flex items-center gap-2">${storeBadge(store, 30)}<span class="font-bold truncate">${h(asText(store.nombre_display))}</span></div></td>
                                ${Array.from({ length: daysInMonth }, (_, i) => this.summaryCell(store, i + 1)).join('')}
                            </tr>`).join('')}
                    </tbody>
                </table>`;
            if (layoutMode === 'desktop') {
                return `<section class="calendar-card app-card desktop-summary-card">${scrollFrame('desktop-table-scroll', table, 'resumen mensual')}</section>`;
            }
            return `<section class="calendar-card app-card overflow-x-auto">${table}</section>`;
        }

        summaryCell(store, day) {
            const key = dateKey(new Date(this.selected.getFullYear(), this.selected.getMonth(), day));
            const rowsForCell = this.monthlyRows.filter((row) => asInt(row.tienda_id) === asInt(store.id) && asText(row.fecha) === key);
            const total = asInt(store.cupo_total);
            const full = total > 0 && rowsForCell.length >= total;
            return `<td class="p-1"><span class="inline-flex w-[42px] h-[30px] items-center justify-center rounded-lg text-[11px] font-black ${full ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}">${total > 0 ? `${rowsForCell.length}/${total}` : rowsForCell.length}</span></td>`;
        }

        promoterAgendaRow(row) {
            const person = byId(this.promoters, row.impulsadora_id);
            const store = byId(this.stores, row.tienda_id);
            const category = byId(this.categories, person?.idCategoria) || byId(this.categories, row.categoria_asignada_id);
            return `
                <button class="agenda-row w-full text-left" onclick="mobileApp.openEntryActions('impulso', ${asInt(row.id)})">
                    ${storeBadge(store, 38)}
                    <span class="flex-1 min-w-0"><span class="app-list-title block truncate text-[#e85d75]">${h(asText(person?.Marca, 'Sin marca'))}</span><span class="app-list-title block truncate">${h(person ? promoterDisplayName(person) : 'Personal')}</span><span class="app-list-subtitle block truncate">${h(asText(store?.nombre_display, 'Punto de venta'))}</span></span>
                    ${category ? miniChip(asText(category.descripcion), '#111827') : ''}
                </button>`;
        }

        openMonthDay(key) {
            const dayRows = this.visibleMonthRows().filter((row) => asText(row.fecha) === key);
            const date = parseDate(key);
            Swal.fire({
                title: prettyDate(date),
                html: `<p class="text-slate-500 mb-3">${dayRows.length} ${dayRows.length === 1 ? 'asignación' : 'asignaciones'}</p>${dayRows.length ? dayRows.map((row) => this.promoterAgendaRow(row)).join('') : emptyState('event_available', 'Día libre', 'No hay personal asignado en esta fecha.')}${this.session.isManager ? `<button class="bottom-action mt-3" onclick="Swal.close(); mobileApp.openPromoterSheetForDate('${key}')">Asignar este día</button>` : ''}`,
                showConfirmButton: false,
                showCloseButton: true,
                width: 420
            });
        }

        openSideCell(personIdsValue, key) {
            const ids = asText(personIdsValue).split(',').map((id) => asInt(id)).filter(Boolean);
            const rowsForCell = this.visibleMonthRows().filter((row) => ids.includes(asInt(row.impulsadora_id)) && asText(row.fecha) === key);
            if (rowsForCell.length) {
                this.openEntryActions('impulso', asInt(rowsForCell[0].id));
                return;
            }
            if (!this.session.isManager) return;
            const date = parseDate(key);
            const person = byId(this.promoters, ids[0]);
            Swal.fire({
                title: person ? promoterDisplayName(person) : 'Asignar turno',
                html: `<p class="text-slate-500 mb-4">${h(prettyDate(date))}</p><button class="bottom-action full" onclick="Swal.close(); mobileApp.showPromoterFormForPerson(${asInt(ids[0])}, '${key}')">Asignar este día</button>`,
                showConfirmButton: false,
                showCloseButton: true
            });
        }

        showPromoterFormForPerson(personId, key) {
            this.showPromoterForm(null, parseDate(key) || this.selected, this.assignmentStoreHint(), personId);
        }

        openEntryActions(kind, id) {
            if (kind === 'interno') {
                const row = this.internalRows.find((item) => asInt(item.id) === id);
                if (this.session.isManager && row) this.openInternalSheet(row);
                return;
            }
            const row = [...this.promoterRows, ...this.monthlyRows].find((item) => asInt(item.id) === id);
            if (!row) return;
            const person = byId(this.promoters, row.impulsadora_id);
            const store = byId(this.stores, row.tienda_id);
            Swal.fire({
                title: person ? promoterDisplayName(person) : 'Turno',
                html: `
                    <p class="text-slate-500 mb-4 text-sm">${h(asText(store?.nombre_display, 'Tienda'))} - ${h(asText(row.fecha))}</p>
                    <div class="grid gap-2">
                        ${person ? `<button class="bottom-action neutral full" onclick="Swal.close(); mobileApp.openVendorScheduleForPerson(${asInt(person.id)}, '${h(asText(row.fecha))}')">Ver horario</button>` : ''}
                        ${this.session.isManager ? `<button class="bottom-action full" onclick="Swal.close(); mobileApp.openPromoterSheet(${asInt(row.id)})">Modificar asignación</button><button class="bottom-action ink full" onclick="Swal.close(); mobileApp.deletePromoter(${asInt(row.id)})">Eliminar</button>` : ''}
                        <button class="bottom-action teal full" onclick="Swal.close(); mobileApp.reportIncident(${asInt(row.id)})">Reportar incidencia</button>
                    </div>`,
                showConfirmButton: false,
                showCloseButton: true
            });
        }

        async selectDate(value) {
            if (value === '__picker__') {
                const { value: picked } = await Swal.fire({
                    title: 'Seleccionar fecha',
                    html: `<input type="date" id="picked-date" class="w-full p-3 border rounded-xl" value="${dateKey(this.selected)}">`,
                    preConfirm: () => document.getElementById('picked-date').value,
                    showCancelButton: true,
                    confirmButtonText: 'Seleccionar'
                });
                if (!picked) return;
                value = picked;
            }
            this.selected = parseDate(value) || this.selected;
            await this.reload();
        }

        async changeMonth(delta) {
            this.selected = new Date(this.selected.getFullYear(), this.selected.getMonth() + delta, 1);
            await this.reload();
        }

        async openVendorScheduleForPerson(personId, value) {
            const date = parseDate(value) || this.selected;
            this.selectedPromoterId = asInt(personId) || null;
            this.vendorMode = true;
            this.sideMode = false;
            this.monthMode = false;
            this.selected = monthStart(date);
            await this.reload();
        }

        toggleMonthMode() {
            this.monthMode = !this.monthMode;
            this.sideMode = false;
            this.vendorMode = false;
            this.selected = this.monthMode ? monthStart(this.selected) : this.selected;
            this.render();
        }

        toggleSideMode() {
            this.sideMode = !this.sideMode;
            this.monthMode = false;
            this.vendorMode = false;
            this.selected = this.sideMode ? monthStart(this.selected) : this.selected;
            this.render();
        }

        closeSideMode() {
            this.sideMode = false;
            this.monthMode = false;
            this.vendorMode = false;
            this.render();
        }

        showDailyMode() {
            this.vendorMode = false;
            this.sideMode = false;
            this.monthMode = false;
            this.render();
        }

        showMonthMode() {
            this.vendorMode = false;
            this.sideMode = false;
            this.monthMode = true;
            this.selected = monthStart(this.selected);
            this.render();
        }

        showSideMode() {
            if (layoutMode !== 'desktop') return;
            this.vendorMode = false;
            this.sideMode = true;
            this.monthMode = false;
            this.selected = monthStart(this.selected);
            this.render();
        }

        showVendorMode() {
            this.vendorMode = true;
            this.sideMode = false;
            this.monthMode = false;
            this.selected = monthStart(this.selected);
            this.render();
        }

        selectVendor(id) {
            this.selectedPromoterId = asInt(id) || null;
            this.render();
        }

        clearVendorSelection() {
            this.selectedPromoterId = null;
            this.render();
        }

        openVendorDay(key) {
            const person = this.selectedVendor();
            if (!person) return;
            const rowsForDay = this.vendorScheduleRows(person).filter((row) => asText(row.fecha) === key);
            if (rowsForDay.length) {
                this.openEntryActions('impulso', asInt(rowsForDay[0].id));
                return;
            }
            if (this.session.isManager) this.showPromoterFormForPerson(asInt(person.id), key);
        }

        setSummary(value) {
            this.summaryMode = value;
            this.render();
        }

        setZone(value) {
            this.zoneFilter = value;
            this.render();
        }

        toggleOnlyAssigned() {
            this.onlyAssigned = !this.onlyAssigned;
            this.render();
        }

        setFilter(value) {
            this.filter = value;
            this.render();
        }

        setSearch(value, input) {
            this.updateSearch(value, input);
        }

        hasStoreFocus() {
            return this.focusedStoreIds.length > 0;
        }

        isStoreFocused(id) {
            return this.focusedStoreIds.includes(asInt(id));
        }

        storeFilterLabel() {
            if (!this.hasStoreFocus()) return 'Operación del día';
            if (this.focusedStoreIds.length === 1) {
                return asText(byId(this.stores, this.focusedStoreIds[0])?.nombre_display, 'Tienda filtrada');
            }
            return `${this.focusedStoreIds.length} tiendas filtradas`;
        }

        assignmentStoreHint() {
            return this.focusedStoreIds.length === 1 ? this.focusedStoreIds[0] : null;
        }

        focusStore(id) {
            if (this.session.isStoreUser) return;
            const storeId = asInt(id);
            this.focusedStoreIds = this.isStoreFocused(storeId)
                ? this.focusedStoreIds.filter((item) => item !== storeId)
                : [...this.focusedStoreIds, storeId];
            this.render();
        }

        clearStoreFocus() {
            this.focusedStoreIds = [];
            this.render();
        }

        openAssignmentTypeSheet() {
            Swal.fire({
                title: 'Nueva asignación',
                html: `
                    <p class="text-slate-500 mb-4">${h(prettyDate(this.selected))}</p>
                    <div class="grid gap-3">
                        <button class="navigation-tile compact app-card" onclick="Swal.close(); mobileApp.openPromoterSheet()"><span class="navigation-icon" style="background:rgba(232,93,117,.16);color:#E85D75"><span class="material-icons">campaign</span></span><span><strong class="block">Personal de impulso</strong><span class="text-sm text-slate-500">Valida cupos por tienda y zona.</span></span></button>
                        <button class="navigation-tile compact app-card" onclick="Swal.close(); mobileApp.openInternalSheet()"><span class="navigation-icon" style="background:rgba(14,159,143,.16);color:#0E9F8F"><span class="material-icons">inventory_2</span></span><span><strong class="block">Personal interno</strong><span class="text-sm text-slate-500">Trabajo, vacaciones, permisos o licencia.</span></span></button>
                    </div>`,
                showConfirmButton: false,
                showCloseButton: true
            });
        }

        openPromoterSheet(id) {
            const existing = id ? [...this.promoterRows, ...this.monthlyRows].find((row) => asInt(row.id) === id) : null;
            this.showPromoterForm(existing, existing ? parseDate(existing.fecha) : this.selected, this.assignmentStoreHint());
        }

        openPromoterSheetForDate(key) {
            this.showPromoterForm(null, parseDate(key) || this.selected, this.assignmentStoreHint());
        }

        async showPromoterForm(existing, date, forcedStoreId, forcedPromoterId) {
            const currentPromoter = asInt(existing?.impulsadora_id || forcedPromoterId || '', '');
            const activePromoters = mergePromoterOptions(this.promoters
                .filter((person) => activePromoter(person) || asInt(person.id) === currentPromoter), currentPromoter);
            const activeStores = this.stores
                .filter((store) => store.activo !== false || asInt(store.id) === asInt(existing?.tienda_id))
                .filter((store) => !this.session.isStoreUser || asInt(store.id) === this.session.storeId);
            const currentDate = dateKey(date || this.selected);
            const currentPromoterPerson = byId(activePromoters, currentPromoter);
            const currentPromoterLabel = currentPromoterPerson ? promoterSearchLabel(currentPromoterPerson) : '';
            const currentStore = asInt(existing?.tienda_id || forcedStoreId || this.session.storeId || '', '');
            const { value } = await Swal.fire({
                title: existing ? 'Modificar impulso' : 'Asignar impulso',
                html: `
                    <div class="grid gap-3 text-left">
                        <label class="text-xs font-bold text-slate-500">Fecha<input id="mw-date" type="date" class="w-full p-3 border rounded-xl mt-1" value="${currentDate}"></label>
                        <label class="text-xs font-bold text-slate-500">Impulsadora<input id="mw-person-search" list="mw-person-options" class="mw-search-input w-full p-3 border rounded-xl mt-1" value="${h(currentPromoterLabel)}" placeholder="Escribe nombre o marca"><datalist id="mw-person-options">${activePromoters.map((person) => `<option value="${h(promoterSearchLabel(person))}" data-id="${asInt(person.id)}"></option>`).join('')}</datalist></label>
                        <label class="text-xs font-bold text-slate-500">Tienda<select id="mw-store" class="mw-store-color-select w-full p-3 border rounded-xl mt-1" style="${storePickerStyle(byId(activeStores, currentStore))}" onchange="mobileApp.paintStorePicker(this)" ${this.session.isStoreUser ? 'disabled' : ''}><option value="">Seleccionar</option>${activeStores.map((store) => `<option value="${asInt(store.id)}" ${asInt(store.id) === currentStore ? 'selected' : ''}>${h(asText(store.nombre_display))}</option>`).join('')}</select></label>
                    </div>`,
                showCancelButton: true,
                confirmButtonText: 'Guardar',
                didOpen: () => this.paintStorePicker(document.getElementById('mw-store')),
                preConfirm: () => {
                    const resolved = resolvePromoterSearch(document.getElementById('mw-person-search').value, activePromoters);
                    if (resolved.state === 'ambiguous') {
                        Swal.showValidationMessage('Hay varias coincidencias. Elige una impulsadora de la lista.');
                        return false;
                    }
                    if (!resolved.id) {
                        Swal.showValidationMessage('Escribe y elige una impulsadora valida.');
                        return false;
                    }
                    return {
                        fecha: document.getElementById('mw-date').value,
                        impulsadora_id: resolved.id,
                        tienda_id: asInt(document.getElementById('mw-store').value || currentStore)
                    };
                }
            });
            if (!value) return;
            if (!value.fecha || !value.impulsadora_id || !value.tienda_id) {
                Swal.fire('Faltan datos', 'Selecciona fecha, impulsadora y tienda.', 'warning');
                return;
            }
            const duplicate = this.monthlyRows.some((row) => asInt(row.impulsadora_id) === value.impulsadora_id && asText(row.fecha) === value.fecha && asInt(row.id) !== asInt(existing?.id));
            if (duplicate) {
                Swal.fire('Asignación duplicada', 'Esa impulsadora ya tiene turno ese día.', 'warning');
                return;
            }
            const quota = this.quotaMessage(value.fecha, value.impulsadora_id, value.tienda_id, asInt(existing?.id, null));
            if (quota) {
                Swal.fire('Cupo lleno', quota, 'warning');
                return;
            }
            const payload = {
                fecha: value.fecha,
                impulsadora_id: value.impulsadora_id,
                tienda_id: value.tienda_id,
                categoria_asignada_id: byId(this.promoters, value.impulsadora_id)?.idCategoria || null
            };
            try {
                if (existing) {
                    await rows(db.from(tables.schedule).update(payload).eq('id', asInt(existing.id)).select());
                } else {
                    await rows(db.from(tables.schedule).insert(payload).select());
                }
                await this.reload();
            } catch (error) {
                Swal.fire('Error', window.StaffPlanner.duplicateMessage(error), 'error');
            }
        }

        quotaMessage(date, promoterId, storeId, existingId) {
            const person = byId(this.promoters, promoterId);
            const store = byId(this.stores, storeId);
            const category = byId(this.categories, person?.idCategoria);
            if (!person || !store || !category) return '';
            const zoneId = asInt(category.id_zona);
            const rowsForStore = this.monthlyRows.filter((row) => asText(row.fecha) === date && asInt(row.tienda_id) === storeId && asInt(row.id) !== existingId);
            let zoneCount = 0;
            rowsForStore.forEach((row) => {
                const rowPerson = byId(this.promoters, row.impulsadora_id);
                const rowCategory = byId(this.categories, rowPerson?.idCategoria);
                if (asInt(rowCategory?.id_zona) === zoneId) zoneCount += 1;
            });
            const zoneLimit = zoneId === 1 ? asInt(store.cupo_zona_a) : asInt(store.cupo_zona_b);
            const totalLimit = asInt(store.cupo_total);
            if (zoneLimit > 0 && zoneCount >= zoneLimit) return `Cupo lleno para ${zoneId === 1 ? 'Zona A' : 'Zona B'} (${zoneCount}/${zoneLimit}).`;
            if (totalLimit > 0 && rowsForStore.length >= totalLimit) return `Cupo total de tienda lleno (${rowsForStore.length}/${totalLimit}).`;
            return '';
        }

        async deletePromoter(id) {
            const ok = await Swal.fire({ title: 'Eliminar asignación', text: 'Esta acción no se puede deshacer.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar' });
            if (!ok.isConfirmed) return;
            try {
                await rows(db.from(tables.schedule).delete().eq('id', id).select());
                await this.reload();
            } catch (error) {
                Swal.fire('Error', error.message, 'error');
            }
        }

        async reportIncident(id) {
            const { value } = await Swal.fire({
                title: 'Reportar incidencia',
                html: `
                    <div class="grid gap-3 text-left">
                        <select id="mw-subject" class="w-full p-3 border rounded-xl">
                            <option value="FALTA INJUSTIFICADA">Falta injustificada</option>
                            <option value="FALTA JUSTIFICADA">Falta justificada</option>
                            <option value="IMPUNTUALIDAD">Impuntualidad</option>
                            <option value="PRESENTACION">Presentación</option>
                            <option value="ACTITUD">Actitud</option>
                            <option value="QUEJA DE CLIENTE">Queja de cliente</option>
                            <option value="OTROS">Otros</option>
                        </select>
                        <textarea id="mw-note" rows="3" class="w-full p-3 border rounded-xl resize-none" placeholder="Observación"></textarea>
                    </div>`,
                showCancelButton: true,
                confirmButtonText: 'Enviar',
                preConfirm: () => ({ asunto: document.getElementById('mw-subject').value, observacion: document.getElementById('mw-note').value || null })
            });
            if (!value) return;
            try {
                const insertedRows = await rows(db.from(tables.incidences).insert({ id_horario: id, asunto: value.asunto, observacion: value.observacion }).select());
                const mailSent = await this.sendIncidentEmail(id, value, insertedRows[0]);
                Swal.fire({
                    icon: mailSent ? 'success' : 'warning',
                    title: mailSent ? 'Reporte enviado' : 'Reporte guardado',
                    text: mailSent ? 'La notificación por correo fue enviada.' : 'No se pudo enviar el correo automático.',
                    timer: mailSent ? 1600 : undefined,
                    showConfirmButton: !mailSent
                });
            } catch (error) {
                Swal.fire('Error', error.message, 'error');
            }
        }

        async sendIncidentEmail(scheduleId, incident, insertedIncident) {
            try {
                const { error } = await db.functions.invoke('send-incidence-email', {
                    body: {
                        idHorario: asInt(scheduleId),
                        incidentId: asInt(insertedIncident?.id),
                        incidenceType: incident.asunto,
                        observation: incident.observacion,
                        reportedBy: asText(this.session.user?.email, this.session.roleName)
                    }
                });
                if (error) throw error;
                return true;
            } catch (error) {
                console.error('No se pudo enviar correo de incidencia:', error);
                return false;
            }
        }

        openInternalSheet(existing) {
            this.showInternalForm(existing, existing ? parseDate(existing.fecha) : this.selected, this.assignmentStoreHint());
        }

        async showInternalForm(existing, date, forcedStoreId) {
            const activeStaff = this.internalStaff
                .filter((person) => activeInternal(person) || asInt(person.id) === asInt(existing?.personal_id))
                .sort((a, b) => asText(a.nombre_completo).localeCompare(asText(b.nombre_completo)));
            const activeStores = this.stores
                .filter((store) => store.activo !== false || asInt(store.id) === asInt(existing?.tienda_id))
                .filter((store) => !this.session.isStoreUser || asInt(store.id) === this.session.storeId);
            const currentDate = dateKey(date || this.selected);
            const currentPerson = asInt(existing?.personal_id, '');
            const currentStore = asInt(existing?.tienda_id || forcedStoreId || this.session.storeId || '', '');
            const currentType = asText(existing?.tipo, 'TRABAJO');
            const { value } = await Swal.fire({
                title: existing ? 'Modificar asignación' : 'Nueva asignación',
                html: `
                    <div class="grid gap-3 text-left">
                        <label class="text-xs font-bold text-slate-500">Fecha<input id="mw-date" type="date" class="w-full p-3 border rounded-xl mt-1" value="${currentDate}"></label>
                        <label class="text-xs font-bold text-slate-500">Personal<select id="mw-person" class="w-full p-3 border rounded-xl mt-1"><option value="">Seleccionar</option>${activeStaff.map((person) => `<option value="${asInt(person.id)}" ${asInt(person.id) === currentPerson ? 'selected' : ''}>${h(asText(person.nombre_completo))}</option>`).join('')}</select></label>
                        <label class="text-xs font-bold text-slate-500">Bodega/Tienda<select id="mw-store" class="mw-store-color-select w-full p-3 border rounded-xl mt-1" style="${storePickerStyle(byId(activeStores, currentStore))}" onchange="mobileApp.paintStorePicker(this)" ${this.session.isStoreUser ? 'disabled' : ''}><option value="">Seleccionar</option>${activeStores.map((store) => `<option value="${asInt(store.id)}" ${asInt(store.id) === currentStore ? 'selected' : ''}>${h(asText(store.nombre_display))}</option>`).join('')}</select></label>
                        <label class="text-xs font-bold text-slate-500">Tipo<select id="mw-type" class="w-full p-3 border rounded-xl mt-1">${['TRABAJO', 'VACACIONES', 'PERMISO', 'LICENCIA'].map((type) => `<option value="${type}" ${type === currentType ? 'selected' : ''}>${type}</option>`).join('')}</select></label>
                    </div>`,
                showCancelButton: true,
                confirmButtonText: 'Guardar',
                didOpen: () => this.paintStorePicker(document.getElementById('mw-store')),
                preConfirm: () => ({
                    fecha: document.getElementById('mw-date').value,
                    personal_id: asInt(document.getElementById('mw-person').value),
                    tienda_id: asInt(document.getElementById('mw-store').value || currentStore),
                    tipo: document.getElementById('mw-type').value
                })
            });
            if (!value) return;
            if (!value.fecha || !value.personal_id || !value.tienda_id) {
                Swal.fire('Faltan datos', 'Selecciona fecha, personal y tienda.', 'warning');
                return;
            }
            const duplicate = this.internalRows.some((row) => asInt(row.personal_id) === value.personal_id && asText(row.fecha) === value.fecha && asInt(row.id) !== asInt(existing?.id));
            if (duplicate) {
                Swal.fire('Asignación duplicada', 'Ese personal ya tiene registro ese día.', 'warning');
                return;
            }
            try {
                if (existing) {
                    await rows(db.from(tables.internalSchedule).update(value).eq('id', asInt(existing.id)).select());
                } else {
                    await rows(db.from(tables.internalSchedule).insert(value).select());
                }
                await this.reload();
            } catch (error) {
                Swal.fire('Error', window.StaffPlanner.duplicateMessage(error), 'error');
            }
        }
    }

    class StoreMonthView extends BaseView {
        constructor() {
            super('store');
            this.selected = monthStart(new Date());
            this.selectedStoreId = null;
            this.search = '';
            this.onlyAssigned = true;
            this.stores = [];
            this.promoters = [];
            this.categories = [];
            this.monthlyRows = [];
            this.todayRows = [];
            this.attendanceRows = [];
        }

        async load() {
            await this.loadBase();
            const todayKey = todayKeyInGuayaquil();
            const [monthlyRows, todayRows, attendanceRows] = await Promise.all([
                this.monthlyPromoterAssignments(this.selected),
                this.promoterAssignmentsForKey(todayKey),
                this.attendanceForKey(todayKey)
            ]);
            this.monthlyRows = monthlyRows;
            this.todayRows = todayRows;
            this.attendanceRows = attendanceRows;
            if (this.session.isStoreUser) this.selectedStoreId = this.session.storeId;
            if (!this.selectedStoreId && this.stores.length) this.selectedStoreId = asInt(this.stores[0].id);
        }

        render() {
            const store = byId(this.stores, this.selectedStoreId);
            shell('store', 'Tienda', this.selectedStoreId ? `${asText(store?.nombre_display, 'Punto de venta')} - ${monthLabel(this.selected)}` : 'Selecciona un punto de venta', iconButton('refresh', 'mobileApp.reload()', 'Actualizar'), this.content());
        }

        content() {
            const rowsForStore = this.visibleRows();
            return `
                ${monthControls(this.selected, 'mobileApp.changeMonth(-1)', 'mobileApp.changeMonth(1)')}
                ${this.filters()}
                ${this.selectedStoreId ? this.attendanceTodaySection() + calendarBoard({
                    selected: this.selected,
                    rows: rowsForStore,
                    badge: storeBadge(byId(this.stores, this.selectedStoreId), 48),
                    subtitle: asText(byId(this.stores, this.selectedStoreId)?.nombre_display, 'Tienda'),
                    countLabel: 'turnos',
                    personId: (row) => promoterCanonicalKey(byId(this.promoters, row.impulsadora_id) || { id: row.impulsadora_id }),
                    peopleLabel: (people) => `${people} personas`,
                    dayHandler: 'mobileApp.openDaySheet',
                    cellContent: (dayRows) => `<div>${dayRows.slice(0, 2).map((row) => this.calendarPersonLabel(row)).join('')}${dayRows.length > 2 ? `<div class="text-[8px] font-black text-[#756c65] mt-1">+${dayRows.length - 2} más</div>` : ''}</div>`
                }) + agendaList({
                    selected: this.selected,
                    rows: rowsForStore,
                    onlyAssigned: this.onlyAssigned,
                    emptyIcon: 'person_off',
                    emptyTitle: 'Sin turnos visibles',
                    emptyMessage: 'No hay días desde hoy para este punto.',
                    daySubtitle: (count) => `${count} persona${count === 1 ? '' : 's'} asignada${count === 1 ? '' : 's'}`,
                    addHandler: this.session.isManager ? 'mobileApp.openAssignmentForDate' : '',
                    row: (row) => this.assignmentRow(row)
                }) : emptyState('storefront', 'Elige una tienda', 'Verás el calendario mensual de personal asignado.')}
            `;
        }

        attendanceTodaySection() {
            const store = byId(this.stores, this.selectedStoreId);
            const todayKey = todayKeyInGuayaquil();
            const rowsForToday = this.todayRows
                .filter((row) => asInt(row.tienda_id) === this.selectedStoreId)
                .sort((a, b) => asText(byId(this.promoters, a.impulsadora_id)?.Marca).localeCompare(asText(byId(this.promoters, b.impulsadora_id)?.Marca)));
            const approved = rowsForToday.filter((row) => asText(this.attendanceForSchedule(row.id)?.estado) === 'aprobada').length;
            return `
                <section class="attendance-panel app-card">
                    <div class="attendance-panel-head">
                        <span class="material-icons">how_to_reg</span>
                        <span class="min-w-0">
                            <strong>Asistencia de hoy</strong>
                            <small>${h(asText(store?.nombre_display, 'Tienda'))} - ${h(todayKey)} - ${approved}/${rowsForToday.length} aprobadas</small>
                        </span>
                    </div>
                    ${rowsForToday.length ? rowsForToday.map((row) => this.attendanceRow(row)).join('') : emptyState('event_busy', 'Sin impulsadoras hoy', 'No hay turnos asignados para este punto en la fecha actual.')}
                </section>`;
        }

        attendanceForSchedule(scheduleId) {
            return this.attendanceRows.find((row) => asInt(row.horario_id) === asInt(scheduleId)) || null;
        }

        attendanceState(attendance) {
            const state = asText(attendance?.estado, 'pendiente');
            if (state === 'aprobada') return { label: 'Aprobada', className: 'approved', icon: 'check_circle' };
            if (state === 'falta_generada') return { label: 'Falta generada', className: 'closed', icon: 'warning_amber' };
            return { label: 'Pendiente', className: 'pending', icon: 'schedule' };
        }

        attendanceRow(row) {
            const person = byId(this.promoters, row.impulsadora_id);
            const category = byId(this.categories, person?.idCategoria) || byId(this.categories, row.categoria_asignada_id);
            const attendance = this.attendanceForSchedule(row.id);
            const state = this.attendanceState(attendance);
            const approvedAt = timeInGuayaquil(attendance?.aprobado_en);
            const approvedLabel = approvedAt ? ` - ${approvedAt}` : '';
            const canApprove = state.className === 'pending';
            return `
                <article class="attendance-row">
                    ${storeBadge(byId(this.stores, this.selectedStoreId), 38)}
                    <span class="flex-1 min-w-0">
                        <span class="app-list-title block truncate text-[#e85d75]">${h(asText(person?.Marca, 'Sin marca'))}</span>
                        <span class="app-list-title block truncate">${h(person ? promoterDisplayName(person) : 'Personal')}</span>
                        <span class="app-list-subtitle block truncate">${category ? h(asText(category.descripcion)) : 'Sin categoria'}</span>
                    </span>
                    <span class="attendance-status ${state.className}"><span class="material-icons">${state.icon}</span>${h(state.label + approvedLabel)}</span>
                    ${canApprove ? `<button class="attendance-approve-btn" onclick="mobileApp.approveAttendance(${asInt(row.id)})">Aprobar</button>` : ''}
                </article>`;
        }

        filters() {
            const options = this.stores
                .filter((store) => (store.activo !== false || asInt(store.id) === this.selectedStoreId) && (!this.session.isStoreUser || asInt(store.id) === this.session.storeId))
                .sort((a, b) => asText(a.nombre_display).localeCompare(asText(b.nombre_display)));
            return `
                <section class="app-filter-stack">
                    <select class="w-full p-3 border rounded-xl font-bold" onchange="mobileApp.selectStore(this.value)" ${this.session.isStoreUser ? 'disabled' : ''}>
                        ${options.map((store) => `<option value="${asInt(store.id)}" ${asInt(store.id) === this.selectedStoreId ? 'selected' : ''}>${h(asText(store.nombre_display))}</option>`).join('')}
                    </select>
                    <label class="app-search"><span class="material-icons">search</span><input data-search-input="${this.active === 'internal' ? 'internal-monthly' : 'store-monthly'}" value="${h(this.search)}" oninput="mobileApp.setSearch(this.value, this)" placeholder="Buscar nombre o marca"></label>
                    <button class="mini-chip justify-center" onclick="mobileApp.toggleOnlyAssigned()">${this.onlyAssigned ? 'Solo asignadas' : 'Mostrar vacías'}</button>
                </section>`;
        }

        visibleRows() {
            const needle = this.search.trim().toLowerCase();
            return this.monthlyRows
                .filter((row) => asInt(row.tienda_id) === this.selectedStoreId)
                .filter((row) => {
                    const person = byId(this.promoters, row.impulsadora_id);
                    if (!person) return false;
                    if (!needle) return true;
                    return `${promoterDisplayName(person)} ${asText(person.Marca)}`.toLowerCase().includes(needle);
                })
                .sort((a, b) => asText(a.fecha).localeCompare(asText(b.fecha)) || asText(byId(this.promoters, a.impulsadora_id)?.Marca).localeCompare(asText(byId(this.promoters, b.impulsadora_id)?.Marca)));
        }

        calendarPersonLabel(row) {
            const person = byId(this.promoters, row.impulsadora_id);
            return `<div class="calendar-label"><strong>${h(asText(person?.Marca, 'Sin marca'))}</strong><span>${h(person ? promoterDisplayName(person) : 'Personal')}</span></div>`;
        }

        assignmentRow(row) {
            const person = byId(this.promoters, row.impulsadora_id);
            const category = byId(this.categories, person?.idCategoria) || byId(this.categories, row.categoria_asignada_id);
            return `
                <button class="agenda-row w-full text-left" onclick="mobileApp.openActions(${asInt(row.id)})">
                    ${storeBadge(byId(this.stores, this.selectedStoreId), 38)}
                    <span class="flex-1 min-w-0"><span class="app-list-title block truncate text-[#e85d75]">${h(asText(person?.Marca, 'Sin marca'))}</span><span class="app-list-title block truncate">${h(person ? promoterDisplayName(person) : 'Personal')}</span></span>
                    ${category ? miniChip(asText(category.descripcion), '#111827') : ''}
                    <span class="material-icons text-slate-400">chevron_right</span>
                </button>`;
        }

        selectStore(value) {
            this.selectedStoreId = asInt(value) || null;
            this.render();
        }

        setSearch(value, input) {
            this.updateSearch(value, input);
        }

        toggleOnlyAssigned() {
            this.onlyAssigned = !this.onlyAssigned;
            this.render();
        }

        async changeMonth(delta) {
            this.selected = new Date(this.selected.getFullYear(), this.selected.getMonth() + delta, 1);
            await this.reload();
        }

        async approveAttendance(id) {
            try {
                Swal.fire({
                    title: 'Aprobando asistencia',
                    allowOutsideClick: false,
                    didOpen: () => Swal.showLoading()
                });
                const { data, error } = await db.functions.invoke('approve-store-attendance', {
                    body: { horarioId: asInt(id) }
                });
                if (error) throw error;
                if (data?.error) throw new Error(data.error);
                await this.reload();
                Swal.fire({ icon: 'success', title: 'Asistencia aprobada', timer: 1400, showConfirmButton: false });
            } catch (error) {
                Swal.fire('Error', error.message || 'No se pudo aprobar la asistencia', 'error');
            }
        }

        openDaySheet(key) {
            const rowsForDay = this.visibleRows().filter((row) => asText(row.fecha) === key);
            const date = parseDate(key);
            Swal.fire({
                title: prettyDate(date),
                html: `<p class="text-slate-500 mb-3">${h(asText(byId(this.stores, this.selectedStoreId)?.nombre_display, 'Tienda'))}</p>${rowsForDay.length ? rowsForDay.map((row) => this.assignmentRow(row)).join('') : emptyState('person_off', 'Sin asignaciones', 'No hay impulsadoras en este punto para esta fecha.')}${this.session.isManager ? `<button class="bottom-action mt-3" onclick="Swal.close(); mobileApp.openAssignmentForDate('${key}')">Asignar este día</button>` : ''}`,
                showConfirmButton: false,
                showCloseButton: true
            });
        }

        openAssignmentForDate(key) {
            this.showPromoterForm(null, parseDate(key) || this.selected, this.selectedStoreId);
        }

        openActions(id) {
            const row = this.monthlyRows.find((item) => asInt(item.id) === id);
            if (!row) return;
            const person = byId(this.promoters, row.impulsadora_id);
            const store = byId(this.stores, row.tienda_id);
            Swal.fire({
                title: person ? promoterDisplayName(person) : 'Turno',
                html: `
                    <p class="text-slate-500 mb-4 text-sm">${h(asText(store?.nombre_display, 'Tienda'))} - ${h(asText(row.fecha))}</p>
                    <div class="grid gap-2">
                        ${this.session.isManager ? `<button class="bottom-action full" onclick="Swal.close(); mobileApp.showPromoterFormById(${asInt(row.id)})">Modificar asignación</button><button class="bottom-action ink full" onclick="Swal.close(); mobileApp.deletePromoter(${asInt(row.id)})">Eliminar</button>` : ''}
                        <button class="bottom-action teal full" onclick="Swal.close(); mobileApp.reportIncident(${asInt(row.id)})">Reportar incidencia</button>
                    </div>`,
                showConfirmButton: false,
                showCloseButton: true
            });
        }

        showPromoterFormById(id) {
            const row = this.monthlyRows.find((item) => asInt(item.id) === id);
            if (row) this.showPromoterForm(row, parseDate(row.fecha), this.selectedStoreId);
        }

        showPromoterForm(existing, date, forcedStoreId) {
            return PlannerView.prototype.showPromoterForm.call(this, existing, date, forcedStoreId);
        }

        quotaMessage(date, promoterId, storeId, existingId) {
            return PlannerView.prototype.quotaMessage.call(this, date, promoterId, storeId, existingId);
        }

        deletePromoter(id) {
            return PlannerView.prototype.deletePromoter.call(this, id);
        }

        reportIncident(id) {
            return PlannerView.prototype.reportIncident.call(this, id);
        }
    }

    class InternalMonthView extends StoreMonthView {
        constructor() {
            super();
            this.active = 'internal';
            this.staff = [];
        }

        async load() {
            await this.loadBase();
            this.staff = this.internalStaff;
            this.monthlyRows = await this.monthlyInternalAssignments(this.selected);
            if (this.session.isStoreUser) this.selectedStoreId = this.session.storeId;
            if (!this.selectedStoreId && this.stores.length) this.selectedStoreId = asInt(this.stores[0].id);
        }

        render() {
            const store = byId(this.stores, this.selectedStoreId);
            const actions = [
                this.session.isManager && this.selectedStoreId ? iconButton('add_circle', 'mobileApp.openAssignmentForDate()', 'Nueva asignación', false, 'primary') : '',
                iconButton('refresh', 'mobileApp.reload()', 'Actualizar')
            ].join('');
            shell('internal', 'Interno', this.selectedStoreId ? `${asText(store?.nombre_display, 'Bodega/Tienda')} - ${monthLabel(this.selected)}` : 'Selecciona bodega o tienda', actions, this.content());
        }

        filters() {
            const options = this.stores
                .filter((store) => (store.activo !== false || asInt(store.id) === this.selectedStoreId) && (!this.session.isStoreUser || asInt(store.id) === this.session.storeId))
                .sort((a, b) => asText(a.nombre_display).localeCompare(asText(b.nombre_display)));
            return `
                <section class="app-filter-stack">
                    <select class="w-full p-3 border rounded-xl font-bold" onchange="mobileApp.selectStore(this.value)" ${this.session.isStoreUser ? 'disabled' : ''}>
                        ${options.map((store) => `<option value="${asInt(store.id)}" ${asInt(store.id) === this.selectedStoreId ? 'selected' : ''}>${h(asText(store.nombre_display))}</option>`).join('')}
                    </select>
                    <label class="app-search"><span class="material-icons">search</span><input data-search-input="internal-monthly" value="${h(this.search)}" oninput="mobileApp.setSearch(this.value, this)" placeholder="Buscar personal o tipo"></label>
                    <button class="mini-chip justify-center" onclick="mobileApp.toggleOnlyAssigned()">${this.onlyAssigned ? 'Solo asignadas' : 'Mostrar vacías'}</button>
                </section>`;
        }

        visibleRows() {
            const needle = this.search.trim().toLowerCase();
            return this.monthlyRows
                .filter((row) => asInt(row.tienda_id) === this.selectedStoreId)
                .filter((row) => {
                    const person = byId(this.staff, row.personal_id);
                    if (!person) return false;
                    if (!needle) return true;
                    return `${asText(person.nombre_completo)} ${asText(person.idVendedor || person.idvendedor)} ${asText(row.tipo)}`.toLowerCase().includes(needle);
                })
                .sort((a, b) => asText(a.fecha).localeCompare(asText(b.fecha)) || asText(a.tipo).localeCompare(asText(b.tipo)));
        }

        content() {
            const rowsForStore = this.visibleRows();
            return `
                ${monthControls(this.selected, 'mobileApp.changeMonth(-1)', 'mobileApp.changeMonth(1)')}
                ${this.filters()}
                ${this.selectedStoreId ? calendarBoard({
                    selected: this.selected,
                    rows: rowsForStore,
                    badge: storeBadge(byId(this.stores, this.selectedStoreId), 48),
                    subtitle: asText(byId(this.stores, this.selectedStoreId)?.nombre_display, 'Bodega/Tienda'),
                    countLabel: 'registros',
                    personId: (row) => asInt(row.personal_id),
                    peopleLabel: (people) => `${people} personas`,
                    dayHandler: 'mobileApp.openDaySheet',
                    cellContent: (dayRows) => `<div>${dayRows.slice(0, 2).map((row) => this.calendarPersonLabel(row)).join('')}${dayRows.length > 2 ? `<div class="text-[8px] font-black text-[#756c65] mt-1">+${dayRows.length - 2} más</div>` : ''}</div>`
                }) + agendaList({
                    selected: this.selected,
                    rows: rowsForStore,
                    onlyAssigned: this.onlyAssigned,
                    emptyIcon: 'person_off',
                    emptyTitle: 'Sin registros visibles',
                    emptyMessage: 'No hay días desde hoy para esta bodega.',
                    daySubtitle: (count) => `${count} registro${count === 1 ? '' : 's'} interno${count === 1 ? '' : 's'}`,
                    addHandler: this.session.isManager ? 'mobileApp.openAssignmentForDate' : '',
                    row: (row) => this.assignmentRow(row)
                }) : emptyState('warehouse', 'Elige una bodega', 'Verás el calendario mensual del personal interno.')}
            `;
        }

        calendarPersonLabel(row) {
            const person = byId(this.staff, row.personal_id);
            const color = internalTypeColor(row.tipo);
            const foreground = isLightColor(color) ? '#111827' : '#ffffff';
            return `<div class="calendar-label" style="background:${h(color)}dd;border-color:${h(color)}"><strong style="color:${foreground}">${h(asText(row.tipo, 'TRABAJO'))}</strong><span style="color:${foreground}">${h(asText(person?.nombre_completo, 'Personal'))}</span></div>`;
        }

        assignmentRow(row) {
            const person = byId(this.staff, row.personal_id);
            const color = internalTypeColor(row.tipo);
            return `
                <button class="agenda-row w-full text-left" onclick="mobileApp.openActions(${asInt(row.id)})">
                    ${storeBadge(byId(this.stores, this.selectedStoreId), 38)}
                    <span class="flex-1 min-w-0"><span class="app-list-title block truncate" style="color:${color}">${h(asText(row.tipo, 'TRABAJO'))}</span><span class="app-list-title block truncate">${h(asText(person?.nombre_completo, 'Personal'))}</span></span>
                    <span class="material-icons text-slate-400">chevron_right</span>
                </button>`;
        }

        openAssignmentForDate(key) {
            this.showInternalForm(null, parseDate(key) || this.defaultAssignmentDate(), this.selectedStoreId);
        }

        defaultAssignmentDate() {
            const today = new Date();
            if (today.getFullYear() === this.selected.getFullYear() && today.getMonth() === this.selected.getMonth()) {
                return new Date(today.getFullYear(), today.getMonth(), today.getDate());
            }
            return this.selected;
        }

        openActions(id) {
            const row = this.monthlyRows.find((item) => asInt(item.id) === id);
            if (!row || !this.session.isManager) return;
            this.showInternalForm(row, parseDate(row.fecha), this.selectedStoreId);
        }

        showInternalForm(existing, date, forcedStoreId) {
            this.internalRows = this.monthlyRows;
            this.internalStaff = this.staff;
            return PlannerView.prototype.showInternalForm.call(this, existing, date, forcedStoreId);
        }
    }

    class ReportsView extends BaseView {
        constructor() {
            super('reports');
            this.incidents = [];
            this.schedules = [];
            this.promoters = [];
            this.stores = [];
            this.personFilter = '';
            this.subjectFilter = '';
            this.from = '';
            this.to = '';
        }

        async load() {
            const [incidents, promoters, stores, schedules] = await Promise.all([
                rows(db.from(tables.incidences).select('*').order('creado_en', { ascending: false })),
                rows(db.from(tables.impulsadoras).select('*')),
                rows(db.from(tables.stores).select('*')),
                rows(db.from(tables.schedule).select('*'))
            ]);
            this.incidents = incidents;
            this.promoters = promoters;
            this.stores = stores;
            this.schedules = schedules;
        }

        enriched() {
            return this.incidents.map((incident) => {
                const schedule = byId(this.schedules, incident.id_horario);
                const person = byId(this.promoters, schedule?.impulsadora_id);
                const store = byId(this.stores, schedule?.tienda_id);
                return {
                    raw: incident,
                    schedule,
                    personName: person ? promoterDisplayName(person) : 'Desconocido',
                    brand: asText(person?.Marca, '-'),
                    storeName: asText(store?.nombre_display, 'Desconocida'),
                    storeColor: colorFromStore(store, '#6366f1'),
                    shiftDate: asText(schedule?.fecha, '-'),
                    created: parseDate(asText(incident.creado_en).slice(0, 10))
                };
            }).filter((item) => {
                if (this.personFilter && item.personName !== this.personFilter) return false;
                if (this.subjectFilter && asText(item.raw.asunto) !== this.subjectFilter) return false;
                if (this.from && item.created && item.created < parseDate(this.from)) return false;
                if (this.to && item.created && item.created > parseDate(this.to)) return false;
                return true;
            });
        }

        render() {
            const filtered = this.enriched();
            const total = filtered.length;
            const absences = filtered.filter((item) => {
                const subject = asText(item.raw.asunto).toUpperCase();
                return subject.includes('FALTA') || subject.includes('INJUSTIFICADA');
            }).length;
            const late = filtered.filter((item) => asText(item.raw.asunto).toUpperCase().includes('IMPUNTUALIDAD')).length;
            const actions = iconButton('file_download', 'mobileApp.copyCsv()', 'Copiar CSV') + iconButton('refresh', 'mobileApp.reload()', 'Actualizar');
            shell('reports', 'Reportes', `${total} incidencias filtradas`, actions, `
                <section class="stat-row three">
                    ${statCard('Total', total, 'list_alt')}
                    ${statCard('Faltas', absences, 'warning_amber', '#DC2626')}
                    ${statCard('Tardes', late, 'timer', '#F97316')}
                </section>
                ${this.filters()}
                ${filtered.length ? filtered.map((item, index) => this.reportTile(item, index)).join('') : emptyState('check_circle', 'No hay incidencias', 'Los filtros actuales no devuelven registros.')}
            `);
        }

        filters() {
            const filteredPeople = [...new Set(this.incidents.map((incident) => {
                const schedule = byId(this.schedules, incident.id_horario);
                const person = byId(this.promoters, schedule?.impulsadora_id);
                return person ? promoterDisplayName(person) : 'Desconocido';
            }))].sort();
            const subjects = ['FALTA NO APROBADA', 'FALTA INJUSTIFICADA', 'FALTA JUSTIFICADA', 'IMPUNTUALIDAD', 'PRESENTACION', 'ACTITUD', 'QUEJA DE CLIENTE', 'OTROS'];
            return `
                <section class="calendar-card app-card mb-3">
                    <div class="grid gap-3">
                        <select class="w-full p-3 border rounded-xl" onchange="mobileApp.setReportFilter('personFilter', this.value)"><option value="">Vendedora</option>${filteredPeople.map((person) => `<option value="${h(person)}" ${person === this.personFilter ? 'selected' : ''}>${h(person)}</option>`).join('')}</select>
                        <select class="w-full p-3 border rounded-xl" onchange="mobileApp.setReportFilter('subjectFilter', this.value)"><option value="">Asunto</option>${subjects.map((subject) => `<option value="${subject}" ${subject === this.subjectFilter ? 'selected' : ''}>${subject}</option>`).join('')}</select>
                        <div class="grid grid-cols-2 gap-2">
                            <input type="date" value="${h(this.from)}" onchange="mobileApp.setReportFilter('from', this.value)" class="p-3 border rounded-xl">
                            <input type="date" value="${h(this.to)}" onchange="mobileApp.setReportFilter('to', this.value)" class="p-3 border rounded-xl">
                        </div>
                        <button class="mini-chip justify-center" onclick="mobileApp.clearFilters()">Limpiar</button>
                    </div>
                </section>`;
        }

        reportTile(item, index) {
            return `
                <button class="app-list-card app-card" onclick="mobileApp.showReport(${index})">
                    <div class="app-list-card-row">
                        <span class="block w-[5px] h-[58px] rounded-full" style="background:${h(item.storeColor)}"></span>
                        <span class="flex-1 min-w-0"><span class="app-list-title truncate block">${h(item.personName)}</span><span class="app-list-subtitle truncate block">${h(item.storeName)} - Turno ${h(item.shiftDate)}</span></span>
                        ${miniChip(asText(item.raw.asunto), this.incidentColor(item.raw.asunto))}
                    </div>
                </button>`;
        }

        incidentColor(subject) {
            const upper = asText(subject).toUpperCase();
            if (upper.includes('NO APROBADA')) return '#B91C1C';
            if (upper.includes('INJUSTIFICADA')) return '#DC2626';
            if (upper.includes('JUSTIFICADA')) return '#F59E0B';
            if (upper.includes('IMPUNTUALIDAD')) return '#F97316';
            if (upper.includes('QUEJA')) return '#7C3AED';
            return '#2563EB';
        }

        setReportFilter(key, value) {
            this[key] = value;
            this.render();
        }

        clearFilters() {
            this.personFilter = '';
            this.subjectFilter = '';
            this.from = '';
            this.to = '';
            this.render();
        }

        async copyCsv() {
            const rowsForCsv = [
                ['Fecha Reporte', 'Vendedora', 'Marca', 'Tienda', 'Fecha Turno', 'Tipo Incidencia', 'Observación'],
                ...this.enriched().map((item) => [
                    asText(item.raw.creado_en),
                    item.personName,
                    item.brand,
                    item.storeName,
                    item.shiftDate,
                    asText(item.raw.asunto),
                    asText(item.raw.observacion)
                ])
            ];
            await copyText(rowsForCsv.map((row) => row.map((cell) => `"${asText(cell).replace(/"/g, '""')}"`).join(',')).join('\n'));
            Swal.fire({ icon: 'success', title: 'CSV copiado', timer: 1300, showConfirmButton: false });
        }

        showReport(index) {
            const item = this.enriched()[index];
            if (!item) return;
            Swal.fire({
                title: item.personName,
                html: `
                    <div class="grid gap-2 text-left">
                        <div><strong>Tienda</strong><p>${h(item.storeName)}</p></div>
                        <div><strong>Turno</strong><p>${h(item.shiftDate)}</p></div>
                        <div><strong>Asunto</strong><p>${h(asText(item.raw.asunto))}</p></div>
                        <div><strong>Observación</strong><p>${h(asText(item.raw.observacion, '-'))}</p></div>
                    </div>`,
                showCloseButton: true,
                showConfirmButton: false
            });
        }
    }

    class NavigationView extends BaseView {
        constructor() {
            super('nav');
        }

        async load() {}

        render() {
            const email = asText(this.session.user?.email, 'Usuario');
            shell('nav', 'Navegación', 'Datos, usuario e integraciones', iconButton('logout', 'mobileApp.logout()', 'Salir'), `
                <button class="navigation-tile app-card" onclick="mobileApp.openData()">
                    <span class="navigation-icon" style="background:rgba(232,93,117,.16);color:#E85D75"><span class="material-icons">dataset</span></span>
                    <span class="flex-1 min-w-0"><strong class="app-list-title block">Datos</strong><span class="app-list-subtitle block">Personal, tiendas, categorías e interno</span></span>
                    <span class="material-icons text-slate-400">chevron_right</span>
                </button>
                <button class="navigation-tile app-card" onclick="mobileApp.profile()">
                    <span class="navigation-icon" style="background:rgba(17,24,39,.12);color:#111827"><span class="material-icons">account_circle</span></span>
                    <span class="flex-1 min-w-0"><strong class="app-list-title block">Usuario</strong><span class="app-list-subtitle block">${h(email)} - ${h(this.session.roleName)}</span></span>
                    <span class="material-icons text-slate-400">chevron_right</span>
                </button>
                <article class="navigation-tile app-card opacity-75">
                    <span class="navigation-icon" style="background:rgba(14,159,143,.16);color:#0E9F8F"><span class="material-icons">extension</span></span>
                    <span class="flex-1 min-w-0"><strong class="app-list-title block">Integraciones</strong><span class="app-list-subtitle block">Espacio listo para nuevos accesos</span></span>
                    <span class="material-icons text-slate-400">lock_clock</span>
                </article>
            `);
        }

        openData() {
            const staffHref = layoutMode === 'desktop' ? 'staff-list-mobile.html' : 'staff-list-mobile.html';
            const storeHref = layoutMode === 'desktop' ? 'store-list-mobile.html' : 'store-list-mobile.html';
            Swal.fire({
                title: 'Datos',
                html: `
                    <div class="grid gap-3">
                        <a class="navigation-tile compact app-card" href="${staffHref}"><span class="navigation-icon" style="background:rgba(232,93,117,.16);color:#E85D75"><span class="material-icons">campaign</span></span><span><strong class="block">Impulsadoras</strong><span class="text-sm text-slate-500">Personal de impulso y marcas</span></span></a>
                        <a class="navigation-tile compact app-card" href="${storeHref}"><span class="navigation-icon" style="background:rgba(14,159,143,.16);color:#0E9F8F"><span class="material-icons">storefront</span></span><span><strong class="block">Tiendas</strong><span class="text-sm text-slate-500">Locales, cupos y estado</span></span></a>
                    </div>`,
                showConfirmButton: false,
                showCloseButton: true
            });
        }

        profile() {
            Swal.fire({
                title: 'Usuario',
                html: `<p class="text-slate-500">${h(asText(this.session.user?.email, 'Usuario'))}</p><p class="font-bold">${h(this.session.roleName)}</p>`,
                showCancelButton: true,
                confirmButtonText: 'Cerrar sesión',
                cancelButtonText: 'Volver'
            }).then((result) => {
                if (result.isConfirmed) this.logout();
            });
        }
    }

    function start(view, options = {}) {
        setLayoutPreference(options.layout);
        const map = {
            planner: PlannerView,
            store: StoreMonthView,
            internal: InternalMonthView,
            reports: ReportsView,
            nav: NavigationView
        };
        const Klass = map[view] || PlannerView;
        const instance = new Klass();
        return instance.init().catch((error) => {
            console.error(error);
            Swal.fire('Error', error.message || 'No se pudo cargar la vista', 'error');
        });
    }

    window.addEventListener('resize', refreshResponsiveLayout);

    window.MobileWeb = {
        start,
        helpers: { h, asText, asInt, dateKey, parseDate, prettyDate, monthLabel, storeBadge, miniChip }
    };
})(window);
