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
    const officialClock = {
        offsetMs: 0,
        status: 'syncing',
        syncedAt: null,
        tickTimer: null,
        syncTimer: null
    };

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
    const plannerIncidentOptions = [
        ['FALTA INJUSTIFICADA', 'Falta injustificada'],
        ['FALTA JUSTIFICADA', 'Falta justificada'],
        ['IMPUNTUALIDAD', 'Impuntualidad'],
        ['PRESENTACION', 'Presentación'],
        ['ACTITUD', 'Actitud'],
        ['QUEJA DE CLIENTE', 'Queja de cliente'],
        ['OTROS', 'Otros']
    ];
    const storeIncidentOptions = [
        ['IMPUNTUALIDAD', 'Impuntualidad'],
        ['PRESENTACION', 'Presentación'],
        ['ACTITUD', 'Actitud'],
        ['QUEJA DE CLIENTE', 'Queja de cliente'],
        ['OTROS', 'Otros']
    ];
    const automaticAbsenceSubject = 'FALTA NO APROBADA';
    const attendanceCloseCutoffHour = 20;
    const desktopMediaQuery = '(min-width: 981px)';
    let layoutMode = 'mobile';
    let layoutPreference = 'auto';

    function navItems() {
        if (window.StaffPlanner?.getRoleId?.() === 3) {
            return [
                ['store', 'calendario-tienda.html', 'storefront', 'Tienda'],
                ['messages', 'mensajes.html', 'inbox', 'Buzón'],
                ['planner', 'index.html', 'space_dashboard', 'Planificar'],
                ['internal', 'personal.html', 'work_outline', 'Interno'],
                ['nav', 'navegacion.html', 'apps', 'Navegación']
            ];
        }
        return [
            ['planner', 'index.html', 'space_dashboard', 'Planificar'],
            ['messages', 'mensajes.html', 'inbox', 'Mensajes'],
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

    function officialNow() {
        return new Date(Date.now() + officialClock.offsetMs);
    }

    function dateKeyInGuayaquil(date = officialNow()) {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Guayaquil',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).formatToParts(date);
        const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
        return `${values.year}-${values.month}-${values.day}`;
    }

    function todayKeyInGuayaquil() {
        return dateKeyInGuayaquil();
    }

    function pageParams() {
        return new URLSearchParams(window.location.search || '');
    }

    function storeViewUrl(storeId, fecha) {
        const params = new URLSearchParams();
        const id = asInt(storeId, null);
        const key = asText(fecha).slice(0, 10);
        if (id) params.set('store', String(id));
        if (/^\d{4}-\d{2}-\d{2}$/.test(key)) params.set('date', key);
        const query = params.toString();
        return `calendario-tienda.html${query ? `?${query}` : ''}`;
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

    function dateTimeInGuayaquil(value) {
        if (!value) return '';
        try {
            return new Intl.DateTimeFormat('es-EC', {
                timeZone: 'America/Guayaquil',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).format(new Date(value));
        } catch (error) {
            return asText(value);
        }
    }

    function attendanceLunchMinutes(attendance) {
        const stored = asInt(attendance?.almuerzo_minutos, NaN);
        if (Number.isFinite(stored)) return stored;
        const out = attendance?.almuerzo_salida_en ? new Date(attendance.almuerzo_salida_en).getTime() : NaN;
        const back = attendance?.almuerzo_ingreso_en ? new Date(attendance.almuerzo_ingreso_en).getTime() : NaN;
        if (!Number.isFinite(out) || !Number.isFinite(back) || back < out) return null;
        return Math.max(0, Math.round((back - out) / 60000));
    }

    function parseDate(value) {
        if (!value) return null;
        const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
        if (!year || !month || !day) return null;
        return new Date(year, month - 1, day);
    }

    function closeCutoffInstant(fecha) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(asText(fecha))) return null;
        const date = new Date(`${fecha}T${String(attendanceCloseCutoffHour).padStart(2, '0')}:00:00-05:00`);
        return Number.isFinite(date.getTime()) ? date : null;
    }

    function isPrematureAutomaticAbsence(incident, schedule) {
        if (asText(incident?.asunto).toUpperCase() !== automaticAbsenceSubject) return false;
        const cutoff = closeCutoffInstant(asText(schedule?.fecha));
        const createdAt = incident?.creado_en ? new Date(incident.creado_en) : null;
        return Boolean(cutoff && createdAt && Number.isFinite(createdAt.getTime()) && createdAt < cutoff);
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

    function shortDateLabel(key) {
        const date = parseDate(key);
        if (!date) return '';
        return `${date.getDate()} ${monthShort[date.getMonth()]} ${date.getFullYear()}`;
    }

    function daysBetweenKeys(fromKey, toKey) {
        const from = parseDate(fromKey);
        const to = parseDate(toKey);
        if (!from || !to) return 0;
        return Math.round((to.getTime() - from.getTime()) / 86400000);
    }

    function clampMonthDay(year, monthIndex, day) {
        const last = new Date(year, monthIndex + 1, 0).getDate();
        return Math.max(1, Math.min(last, asInt(day, 1)));
    }

    function monthKeyFor(year, monthIndex) {
        return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    }

    function messageStateKey(messageId, occurrenceKey) {
        return `${asInt(messageId)}:${asText(occurrenceKey, 'single')}`;
    }

    function messageStateMap(states) {
        const map = new Map();
        states.forEach((state) => map.set(messageStateKey(state.mensaje_id, state.occurrence_key), state));
        return map;
    }

    function messageAction(message) {
        if (asText(message?.accion_requerida, '').trim()) return asText(message.accion_requerida);
        return asText(message?.tipo) === 'tarea' ? 'completado' : 'visto';
    }

    function isMessageArchived(message, state) {
        if (!state) return false;
        if (state.archivado_en) return true;
        return messageAction(message) === 'completado' ? Boolean(state.completado_en) : Boolean(state.visto_en);
    }

    function monthlyStartForMessage(message, today) {
        const published = parseDate(message?.publicar_en) || today;
        const floor = new Date(today.getFullYear(), today.getMonth() - 18, 1);
        const start = published > floor ? published : floor;
        return new Date(start.getFullYear(), start.getMonth(), 1);
    }

    function messageOccurrenceEntries(messages, states, archived = false) {
        const todayKey = todayKeyInGuayaquil();
        const today = parseDate(todayKey) || new Date();
        const stateMap = messageStateMap(states);
        const entries = [];

        messages.filter((message) => message?.activo !== false).forEach((message) => {
            if (asText(message.recurrencia, 'ninguna') === 'mensual') {
                const publishDay = asInt(message.dia_publicacion_mensual, 1);
                const dueDay = asInt(message.dia_vencimiento_mensual, publishDay);
                const messagePublishKey = asText(message.publicar_en).slice(0, 10);
                let cursor = monthlyStartForMessage(message, today);
                while (cursor.getFullYear() < today.getFullYear() || (cursor.getFullYear() === today.getFullYear() && cursor.getMonth() <= today.getMonth())) {
                    const rawPublishKey = dateKey(new Date(cursor.getFullYear(), cursor.getMonth(), clampMonthDay(cursor.getFullYear(), cursor.getMonth(), publishDay)));
                    const occurrenceKey = monthKeyFor(cursor.getFullYear(), cursor.getMonth());
                    const publishKey = messagePublishKey.startsWith(occurrenceKey) && rawPublishKey < messagePublishKey ? messagePublishKey : rawPublishKey;
                    if (publishKey <= todayKey) {
                        const dueKey = dateKey(new Date(cursor.getFullYear(), cursor.getMonth(), clampMonthDay(cursor.getFullYear(), cursor.getMonth(), dueDay)));
                        const state = stateMap.get(messageStateKey(message.id, occurrenceKey)) || null;
                        if (isMessageArchived(message, state) === archived) {
                            entries.push({ message, state, occurrenceKey, publishKey, dueKey });
                        }
                    }
                    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
                }
                return;
            }

            const publishKey = asText(message.publicar_en).slice(0, 10) || todayKey;
            if (publishKey > todayKey) return;
            const occurrenceKey = 'single';
            const state = stateMap.get(messageStateKey(message.id, occurrenceKey)) || null;
            if (isMessageArchived(message, state) === archived) {
                entries.push({
                    message,
                    state,
                    occurrenceKey,
                    publishKey,
                    dueKey: asText(message.vence_en).slice(0, 10)
                });
            }
        });

        return entries.sort((a, b) => {
            if (!archived) {
                const today = todayKeyInGuayaquil();
                const aOverdue = a.dueKey && a.dueKey < today ? 0 : 1;
                const bOverdue = b.dueKey && b.dueKey < today ? 0 : 1;
                if (aOverdue !== bOverdue) return aOverdue - bOverdue;
                const aDue = a.dueKey || '9999-12-31';
                const bDue = b.dueKey || '9999-12-31';
                if (aDue !== bDue) return aDue.localeCompare(bDue);
                return asText(b.publishKey).localeCompare(asText(a.publishKey));
            }
            const aArchived = asText(a.state?.archivado_en || a.state?.completado_en || a.state?.visto_en);
            const bArchived = asText(b.state?.archivado_en || b.state?.completado_en || b.state?.visto_en);
            return bArchived.localeCompare(aArchived);
        });
    }

    function messageDueBadge(entry) {
        if (!entry.dueKey) return '';
        const today = todayKeyInGuayaquil();
        const diff = daysBetweenKeys(today, entry.dueKey);
        if (diff < 0) return `<span class="message-due-badge overdue">Vencida hace ${Math.abs(diff)} d</span>`;
        if (diff === 0) return '<span class="message-due-badge today">Vence hoy</span>';
        if (diff <= 3) return `<span class="message-due-badge soon">Vence en ${diff} d</span>`;
        return `<span class="message-due-badge">Vence ${h(shortDateLabel(entry.dueKey))}</span>`;
    }

    function messageEntryTitle(entry) {
        const title = asText(entry?.message?.titulo, 'Mensaje');
        if (asText(entry?.message?.recurrencia) !== 'mensual') return title;
        const monthDate = parseDate(`${asText(entry.occurrenceKey)}-01`);
        return monthDate ? `${title} - ${monthLabel(monthDate)}` : title;
    }

    function messagePreview(message) {
        return asText(message?.resumen || message?.detalle, 'Sin detalle.');
    }

    function messageKindIcon(message) {
        return messageAction(message) === 'completado' ? 'task_alt' : 'mark_email_unread';
    }

    function messageActionIcon(message) {
        return messageAction(message) === 'completado' ? 'check_circle' : 'done';
    }

    function messageActionLabel(message) {
        return messageAction(message) === 'completado' ? 'Marcar completada' : 'Marcar visto';
    }

    function messageDetailHtml(entry) {
        const message = entry.message;
        const detail = asText(message.detalle || message.resumen, 'Sin detalle.');
        const meta = [
            asText(message.tipo) === 'tarea' ? 'Tarea' : 'Aviso',
            asText(message.recurrencia) === 'mensual' ? 'Mensual' : 'Unico',
            entry.dueKey ? `Vence ${shortDateLabel(entry.dueKey)}` : ''
        ].filter(Boolean);
        return `
            <div class="message-detail text-left">
                <div class="message-detail-meta">${meta.map((item) => `<span>${h(item)}</span>`).join('')}</div>
                <p>${h(detail)}</p>
                ${messageDueBadge(entry)}
            </div>`;
    }

    async function archiveMessageEntry(entry) {
        const userId = asInt(sessionStorage.getItem('staffPlannerUserId'));
        if (!userId) throw new Error('No se encontró el usuario de la sesión.');
        const now = new Date().toISOString();
        const payload = {
            mensaje_id: asInt(entry.message.id),
            usuario_id: userId,
            occurrence_key: asText(entry.occurrenceKey, 'single'),
            archivado_en: now,
            actualizado_en: now
        };
        if (messageAction(entry.message) === 'completado') {
            payload.visto_en = entry.state?.visto_en || now;
            payload.completado_en = now;
        } else {
            payload.visto_en = now;
        }
        const { data, error } = await db
            .from(tables.messageStates)
            .upsert(payload, { onConflict: 'mensaje_id,usuario_id,occurrence_key' })
            .select();
        if (error) throw error;
        return data?.[0] || null;
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

    function promoterPin(person) {
        return asText(person?.pin ?? person?.PIN);
    }

    function promoterVendorMeta(person) {
        const parts = [asText(person?.Marca, 'Sin marca')];
        if (asText(person?.idVendedor)) parts.push(`Codigo ${asText(person.idVendedor)}`);
        if (promoterPin(person)) parts.push(`PIN ${promoterPin(person)}`);
        return parts.join(' - ');
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

    function isMissingMessageTable(error) {
        const message = asText(error?.message || error?.details || error);
        return error?.code === '42P01'
            || error?.code === 'PGRST205'
            || message.includes('Tiendas_Mensajes');
    }

    async function messageRows(query) {
        const { data, error } = await query;
        if (error) {
            if (isMissingMessageTable(error)) return [];
            throw error;
        }
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

    function officialClockLabel() {
        const now = officialNow();
        const time = new Intl.DateTimeFormat('es-EC', {
            timeZone: 'America/Guayaquil',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).format(now);
        const date = new Intl.DateTimeFormat('es-EC', {
            timeZone: 'America/Guayaquil',
            weekday: 'short',
            day: '2-digit',
            month: 'short'
        }).format(now).replace('.', '');
        return { time, date };
    }

    function globalClockMarkup() {
        return `
            <div class="official-clock ${h(officialClock.status)}" title="Reloj oficial America/Guayaquil">
                <span class="material-icons">schedule</span>
                <span class="official-clock-copy">
                    <strong data-official-clock-time>--:--:--</strong>
                    <small><span data-official-clock-date>Sincronizando</span> · <span data-official-clock-status>Oficial</span></small>
                </span>
            </div>`;
    }

    function renderOfficialClock() {
        const label = officialClockLabel();
        document.querySelectorAll('[data-official-clock-time]').forEach((node) => { node.textContent = label.time; });
        document.querySelectorAll('[data-official-clock-date]').forEach((node) => { node.textContent = label.date; });
        document.querySelectorAll('[data-official-clock-status]').forEach((node) => {
            node.textContent = officialClock.status === 'synced' ? 'Oficial' : 'Local';
        });
        document.querySelectorAll('.official-clock').forEach((node) => {
            node.classList.toggle('synced', officialClock.status === 'synced');
            node.classList.toggle('fallback', officialClock.status !== 'synced');
        });
    }

    async function syncOfficialClock() {
        const previousDateKey = todayKeyInGuayaquil();
        try {
            const requestStartedAt = Date.now();
            const { data, error } = await db.functions.invoke('server-clock', { body: {} });
            const requestFinishedAt = Date.now();
            if (error) throw error;
            const serverMs = Date.parse(data?.iso);
            if (!Number.isFinite(serverMs)) throw new Error('Hora oficial invalida');
            const networkMidpointMs = requestStartedAt + ((requestFinishedAt - requestStartedAt) / 2);
            officialClock.offsetMs = serverMs - networkMidpointMs;
            officialClock.status = 'synced';
            officialClock.syncedAt = new Date().toISOString();
        } catch (error) {
            console.error('No se pudo sincronizar reloj oficial:', error);
            officialClock.status = 'fallback';
        }
        renderOfficialClock();
        if (previousDateKey !== todayKeyInGuayaquil() && window.mobileApp?.reload) {
            window.mobileApp.reload();
        }
    }

    function startOfficialClock() {
        if (!officialClock.tickTimer) {
            officialClock.tickTimer = window.setInterval(renderOfficialClock, 1000);
        }
        if (!officialClock.syncTimer) {
            syncOfficialClock();
            officialClock.syncTimer = window.setInterval(syncOfficialClock, 5 * 60 * 1000);
        }
        renderOfficialClock();
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
                            <div class="desktop-user-profile">
                                <span class="store-badge-ui" style="width:42px;height:42px;background:#111827;color:#fff">${h(initials(asText(user.user?.email, 'U'), 1))}</span>
                                <span class="min-w-0">
                                    <strong>${h(user.roleName)}</strong>
                                    <small>${h(asText(user.user?.email, 'Usuario'))}</small>
                                </span>
                            </div>
                            <button class="desktop-logout-btn" type="button" onclick="mobileApp.logout()">
                                <span class="material-icons">logout</span>
                                <span>Cerrar sesión</span>
                            </button>
                        </div>
                    </aside>
                    <section class="desktop-main">
                        <header class="desktop-topbar">
                            <div class="desktop-title-block">
                                <div class="desktop-breadcrumb">${h(current?.[3] || title)}</div>
                                <h1>${h(title)}</h1>
                                ${subtitle ? `<p>${h(subtitle)}</p>` : ''}
                            </div>
                            <div class="desktop-topbar-tools">
                                ${globalClockMarkup()}
                                <div class="planner-actions">${actions || ''}</div>
                            </div>
                        </header>
                        <main class="desktop-content">${content}</main>
                    </section>
                </div>`;
            startOfficialClock();
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
                    ${globalClockMarkup()}
                    <div class="planner-actions">${actions || ''}</div>
                </header>
                <main class="planner-content">${content}</main>
                ${nav(active)}
            </div>`;
        startOfficialClock();
    }

    function iconButton(icon, handler, title = '', active = false, tone = '', iconOnly = false) {
        const compact = iconOnly || title === 'Actualizar';
        const label = layoutMode === 'desktop' && title && !compact ? `<span class="planner-btn-label">${h(title)}</span>` : '';
        return `<button type="button" class="planner-icon-btn ${tone ? h(tone) : ''} ${compact ? 'icon-only' : ''} ${active ? 'active' : ''}" title="${h(title)}" aria-label="${h(title || icon)}" onclick="${handler}"><span class="material-icons">${h(icon)}</span>${label}</button>`;
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
        const today = officialNow();
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
            const isToday = key === todayKeyInGuayaquil();
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
        const today = officialNow();
        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const days = [];
        for (let day = 1; day <= daysInMonth; day += 1) {
            const date = new Date(options.selected.getFullYear(), options.selected.getMonth(), day);
            if (date < todayOnly) continue;
            if (options.onlyAssigned && !(grouped[day] || []).length) continue;
            days.push(date);
        }
        const title = options.title || 'Listado desde hoy';
        const summary = options.collapsible ? `
            <summary class="agenda-toggle">
                <span>
                    <strong>${h(title)}</strong>
                    <small>${days.length} ${days.length === 1 ? 'día' : 'días'}</small>
                </span>
                <span class="material-icons agenda-toggle-icon">expand_more</span>
            </summary>` : '';
        const wrap = (content) => options.collapsible
            ? `<details class="agenda-list agenda-collapsible">${summary}<div class="agenda-body">${content}</div></details>`
            : `<section class="agenda-list"><h2>${h(title)}</h2>${content}</section>`;
        if (!days.length) {
            return wrap(emptyState(options.emptyIcon, options.emptyTitle, options.emptyMessage));
        }
        return wrap(days.map((date) => {
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
        }).join(''));
    }

    function statCard(label, value, icon, color = '#E85D75') {
        return `<article class="stat-card-ui app-card"><span class="material-icons" style="color:${h(color)}">${h(icon)}</span><div class="stat-card-value">${h(value)}</div><div class="stat-card-label">${h(label)}</div></article>`;
    }

    function progressBar(value, color) {
        const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
        return `<div class="h-2 rounded-full bg-[#e9e2dd] overflow-hidden"><div class="h-full rounded-full" style="width:${pct}%;background:${h(color)}"></div></div>`;
    }

    const internalStoreToneShifts = [-0.28, -0.16, -0.06, 0.08, 0.18, 0.28, 0.38, -0.36, 0.48, -0.22];

    function stableToneIndex(value) {
        const text = asText(value);
        let hash = 0;
        for (let index = 0; index < text.length; index += 1) {
            hash = ((hash << 5) - hash) + text.charCodeAt(index);
            hash |= 0;
        }
        return Math.abs(hash) % internalStoreToneShifts.length;
    }

    function parseHexParts(hexColor, fallback = '#0E9F8F') {
        let hex = asText(hexColor, fallback).trim().replace('#', '');
        if (hex.length === 3) hex = hex.split('').map((char) => char + char).join('');
        if (!/^[0-9a-fA-F]{6}$/.test(hex)) return parseHexParts(fallback, '#0E9F8F');
        return {
            r: parseInt(hex.slice(0, 2), 16),
            g: parseInt(hex.slice(2, 4), 16),
            b: parseInt(hex.slice(4, 6), 16)
        };
    }

    function rgbToHex({ r, g, b }) {
        return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`;
    }

    function mixHexColor(source, target, amount) {
        const a = parseHexParts(source);
        const b = parseHexParts(target);
        const mix = Math.max(0, Math.min(1, amount));
        return rgbToHex({
            r: a.r + (b.r - a.r) * mix,
            g: a.g + (b.g - a.g) * mix,
            b: a.b + (b.b - a.b) * mix
        });
    }

    function shiftHexColor(source, shift) {
        return shift < 0
            ? mixHexColor(source, '#111827', Math.abs(shift))
            : mixHexColor(source, '#ffffff', shift);
    }

    function normalizedInternalType(type) {
        return asText(type)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toUpperCase();
    }

    function isInternalFreeType(type) {
        const value = normalizedInternalType(type);
        return ['VACACIONES', 'PERMISO', 'LICENCIA', 'LIBRE', 'DIA LIBRE', 'DESCANSO', 'DESCANSO SEMANAL', 'OFF'].includes(value)
            || value.includes('LIBRE')
            || value.includes('DESCANSO');
    }

    function internalPersonTone(person, row, store) {
        if (isInternalFreeType(row?.tipo)) {
            return {
                bg: '#111827',
                border: '#000000',
                avatar: '#111827',
                text: '#FFFFFF',
                avatarText: '#FFFFFF'
            };
        }
        const key = asText(person?.id || row?.personal_id || person?.nombre_completo || row?.id);
        const base = colorFromStore(store, '#0E9F8F');
        const bg = shiftHexColor(base, internalStoreToneShifts[stableToneIndex(key || 'interno')]);
        const border = shiftHexColor(bg, -0.18);
        const avatar = shiftHexColor(bg, -0.28);
        return {
            bg,
            border,
            avatar,
            text: isLightColor(bg) ? '#111827' : '#FFFFFF',
            avatarText: isLightColor(avatar) ? '#111827' : '#FFFFFF'
        };
    }

    function internalPersonInitials(person) {
        return initials(asText(person?.nombre_completo, 'P'), 2);
    }

    function internalTypeColor(type) {
        return isInternalFreeType(type) ? '#111827' : '#0E9F8F';
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
            if (this.shouldScopeToStore() && this.session.storeId) query = query.eq('tienda_id', this.session.storeId);
            return rows(query);
        }

        async promoterAssignments(date) {
            return this.promoterAssignmentsForKey(dateKey(date));
        }

        async attendanceForKey(key) {
            if (!tables.attendance) return [];
            try {
                let query = db.from(tables.attendance).select('*').eq('fecha', key);
                if (this.shouldScopeToStore() && this.session.storeId) query = query.eq('tienda_id', this.session.storeId);
                return await rows(query);
            } catch (error) {
                if (isMissingAttendanceTable(error)) return [];
                throw error;
            }
        }

        async internalAssignments(date) {
            let query = db.from(tables.internalSchedule).select('*').eq('fecha', dateKey(date));
            if (this.shouldScopeToStore() && this.session.storeId) query = query.eq('tienda_id', this.session.storeId);
            return rows(query);
        }

        async monthlyPromoterAssignments(date) {
            let query = db.from(tables.schedule)
                .select('*')
                .gte('fecha', dateKey(monthStart(date)))
                .lte('fecha', dateKey(monthEnd(date)))
                .order('fecha');
            if (this.shouldScopeToStore() && this.session.storeId) query = query.eq('tienda_id', this.session.storeId);
            return rows(query);
        }

        async monthlyInternalAssignments(date, options = {}) {
            let query = db.from(tables.internalSchedule)
                .select('*')
                .gte('fecha', dateKey(monthStart(date)))
                .lte('fecha', dateKey(monthEnd(date)))
                .order('fecha');
            const shouldScope = options.scopeToStore !== false && this.shouldScopeToStore();
            if (shouldScope && this.session.storeId) query = query.eq('tienda_id', this.session.storeId);
            return rows(query);
        }

        shouldScopeToStore() {
            return this.session.isStoreUser;
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
            this.vendorKind = 'impulso';
            this.selectedPromoterId = null;
            this.selectedInternalVendorId = null;
            this.focusedStoreIds = [];
            this.stores = [];
            this.promoters = [];
            this.categories = [];
            this.internalStaff = [];
            this.promoterRows = [];
            this.internalRows = [];
            this.monthlyRows = [];
            this.monthlyInternalRows = [];
            this.attendanceRows = [];
            this.incidentRows = [];
            this.brandCatalog = [];
        }

        async load() {
            await this.loadBase();
            const [promoterRows, internalRows, monthlyRows, monthlyInternalRows, attendanceRows] = await Promise.all([
                this.promoterAssignments(this.selected),
                this.internalAssignments(this.selected),
                this.monthlyPromoterAssignments(this.selected),
                this.monthlyInternalAssignments(this.selected),
                this.attendanceForKey(dateKey(this.selected))
            ]);
            this.promoterRows = promoterRows;
            this.internalRows = internalRows;
            this.monthlyRows = monthlyRows;
            this.monthlyInternalRows = monthlyInternalRows;
            this.attendanceRows = attendanceRows;
            const scheduleIds = promoterRows.map((row) => asInt(row.id)).filter(Boolean);
            this.incidentRows = scheduleIds.length
                ? (await rows(db.from(tables.incidences).select('*').in('id_horario', scheduleIds).order('creado_en', { ascending: false })))
                    .filter((incident) => asText(incident.asunto).toUpperCase() !== automaticAbsenceSubject)
                : [];
        }

        shouldScopeToStore() {
            return false;
        }

        canManagePlanner() {
            return this.session.isManager;
        }

        canEditVendor() {
            return this.session.isManager;
        }

        canReportFromPlanner() {
            return this.session.isManager;
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
                ${this.canManagePlanner() ? '<button class="bottom-action" onclick="mobileApp.openAssignmentTypeSheet()">Asignar personal</button>' : ''}
            `;
        }

        hero(promoterCount, internalCount, storeCount, capacityAlerts) {
            const title = this.storeFilterLabel();
            return `
                <section class="planner-hero">
                    <div class="planner-hero-title"><span class="material-icons">route</span><span class="truncate">${h(title)}</span>${this.hasStoreFocus() ? '<button class="ml-auto" onclick="mobileApp.clearStoreFocus()"><span class="material-icons">close</span></button>' : ''}</div>
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
                <div class="section-title-row"><h2>Capacidad por tienda</h2>${selectedCount ? `<button class="mini-chip" onclick="mobileApp.clearStoreFocus()">Todas (${selectedCount})</button>` : ''}</div>
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
                    <label class="app-search"><span class="material-icons">search</span><input data-search-input="planner-daily" value="${h(this.search)}" oninput="mobileApp.setSearch(this.value, this)" placeholder="Buscar persona, marca, proveedor o tienda"></label>
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
                    const haystack = `${promoterDisplayName(entry.person)} ${asText(entry.person?.Marca)} ${asText(entry.person?.Proveedor)} ${asText(entry.store?.nombre_display)} ${asText(entry.row.tipo)}`;
                    return normalizeSearch(haystack).includes(normalizeSearch(needle));
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

        plannerAttendanceForSchedule(scheduleId) {
            return this.attendanceRows.find((row) => asInt(row.horario_id) === asInt(scheduleId)) || null;
        }

        plannerIncidentsForSchedule(scheduleId) {
            return this.incidentRows.filter((row) => asInt(row.id_horario) === asInt(scheduleId));
        }

        plannerAttendanceState(attendance) {
            const state = asText(attendance?.estado, '');
            if (state === 'aprobada') return { label: 'Aprobada', className: 'approved', icon: 'check_circle' };
            if (state === 'falta_generada') return { label: 'Falta generada', className: 'closed', icon: 'warning_amber' };
            if (state) return { label: 'Pendiente', className: 'pending', icon: 'schedule' };
            return { label: 'Pendiente', className: 'pending', icon: 'schedule' };
        }

        plannerStatusBadges(entry) {
            if (entry.kind !== 'impulso') return '';
            const attendance = this.plannerAttendanceForSchedule(entry.row.id);
            const attendanceState = this.plannerAttendanceState(attendance);
            const incidents = this.plannerIncidentsForSchedule(entry.row.id);
            const attendanceLabel = attendanceState
                ? `${attendanceState.label}${attendance?.aprobado_en ? ` - ${timeInGuayaquil(attendance.aprobado_en)}` : ''}`
                : '';
            const attendanceBadge = attendanceState ? `
                <button type="button" class="planner-status-badge icon-only ${attendanceState.className}" title="${h(attendanceLabel)}" aria-label="${h(attendanceLabel)}" onclick="mobileApp.showPlannerAttendance(${asInt(entry.row.id)})">
                    <span class="material-icons">${h(attendanceState.icon)}</span>
                </button>` : '';
            const incidentBadge = incidents.length ? `
                <button type="button" class="planner-status-badge incident" title="Ver incidencias reportadas" onclick="mobileApp.showPlannerIncidents(${asInt(entry.row.id)})">
                    <span class="material-icons">report_problem</span>
                    <span>${incidents.length}</span>
                </button>` : '';
            return [attendanceBadge, incidentBadge].filter(Boolean).join('');
        }

        entryTile(entry) {
            const isPromoter = entry.kind === 'impulso';
            const color = isPromoter ? colorFromStore(entry.store) : internalTypeColor(entry.row.tipo);
            const subtitle = isPromoter
                ? `${asText(entry.person?.Marca, 'Sin marca')} - ${asText(entry.category?.descripcion, 'Sin cat.')}`
                : `${asText(entry.row.tipo, 'TRABAJO')} - ${asText(entry.store?.nombre_display, 'Tienda')}`;
            const statusBadges = this.plannerStatusBadges(entry);
            if (isPromoter) {
                return `
                    <article class="app-list-card app-card daily-entry-card">
                        <button type="button" class="daily-entry-main" onclick="mobileApp.openEntryActions('${entry.kind}', ${asInt(entry.row.id)})">
                            <div class="app-list-card-row">
                                ${storeBadge(entry.store, 48)}
                                <span class="flex-1 min-w-0"><span class="app-list-title truncate block">${h(promoterDisplayName(entry.person))}</span><span class="app-list-subtitle truncate block">${h(subtitle)}</span></span>
                                ${miniChip('Impulso', color)}
                                <span class="material-icons text-slate-400">chevron_right</span>
                            </div>
                        </button>
                        ${statusBadges ? `<span class="daily-entry-badges">${statusBadges}</span>` : ''}
                    </article>`;
            }
            return `
                <button class="app-list-card app-card" onclick="mobileApp.openEntryActions('${entry.kind}', ${asInt(entry.row.id)})">
                    <div class="app-list-card-row">
                        <span class="store-badge-ui" style="width:48px;height:48px;background:${color}2e;color:${color}"><span class="material-icons">inventory_2</span></span>
                        <span class="flex-1 min-w-0"><span class="app-list-title truncate block">${h(asText(entry.person?.nombre_completo, 'Personal'))}</span><span class="app-list-subtitle truncate block">${h(subtitle)}</span></span>
                        ${miniChip('Interno', color)}
                        <span class="material-icons text-slate-400">chevron_right</span>
                    </div>
                </button>`;
        }

        showPlannerAttendance(id) {
            const row = this.promoterRows.find((item) => asInt(item.id) === asInt(id));
            const attendance = this.plannerAttendanceForSchedule(id);
            if (!row) {
                Swal.fire('Sin turno', 'No se encontró el turno seleccionado.', 'info');
                return;
            }
            const person = byId(this.promoters, row.impulsadora_id);
            const store = byId(this.stores, row.tienda_id);
            const state = this.plannerAttendanceState(attendance);
            const lunchMinutes = attendanceLunchMinutes(attendance);
            const field = (label, value) => `
                <div class="attendance-detail-field">
                    <span>${h(label)}</span>
                    <strong>${h(value || '-')}</strong>
                </div>`;
            Swal.fire({
                title: person ? promoterDisplayName(person) : 'Asistencia',
                html: `
                    <div class="attendance-detail-modal text-left">
                        <p class="app-list-subtitle mb-3">${h(asText(store?.nombre_display, 'Tienda'))} - ${h(asText(row.fecha))}</p>
                        ${field('Estado', state.label)}
                        ${field('Aprobación / llegada', timeInGuayaquil(attendance?.aprobado_en))}
                        ${field('Salida al almuerzo', timeInGuayaquil(attendance?.almuerzo_salida_en))}
                        ${field('Entrada del almuerzo', timeInGuayaquil(attendance?.almuerzo_ingreso_en))}
                        ${field('Tiempo de almuerzo', lunchMinutes === null ? '' : `${lunchMinutes} min`)}
                        ${field('Salida de jornada', timeInGuayaquil(attendance?.salida_en))}
                        ${field('Cierre', dateTimeInGuayaquil(attendance?.cerrado_en))}
                    </div>`,
                confirmButtonText: 'Ir a Tienda',
                showCloseButton: true
            }).then((result) => {
                if (result.isConfirmed) this.goToStoreFromPlanner(row);
            });
        }

        goToStoreFromPlanner(row) {
            if (this.session.isStoreUser && asInt(row?.tienda_id) !== asInt(this.session.storeId)) {
                Swal.fire('Punto no vinculado', 'Tu usuario de tienda solo puede abrir su propio punto de venta.', 'info');
                return;
            }
            window.location.href = storeViewUrl(row?.tienda_id, row?.fecha);
        }

        showPlannerIncidents(id) {
            const row = this.promoterRows.find((item) => asInt(item.id) === asInt(id));
            const incidents = this.plannerIncidentsForSchedule(id);
            if (!row || !incidents.length) {
                Swal.fire('Sin incidencias', 'No hay incidencias reportadas para este turno.', 'info');
                return;
            }
            const person = byId(this.promoters, row.impulsadora_id);
            const incidentRows = incidents.map((incident) => `
                <article class="attendance-incident-detail">
                    <strong>${h(asText(incident.asunto, 'Incidencia'))}</strong>
                    <small>${h(dateTimeInGuayaquil(incident.creado_en))}</small>
                    <p>${h(asText(incident.observacion, 'Sin observación'))}</p>
                </article>`).join('');
            Swal.fire({
                title: person ? promoterDisplayName(person) : 'Incidencias',
                html: `<div class="grid gap-2 text-left">${incidentRows}</div>`,
                showConfirmButton: false,
                showCloseButton: true
            });
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
            const subtitle = person
                ? (this.vendorKind === 'interno' ? `INTERNO - ${asText(person.nombre_completo, 'Personal')}` : `${asText(person.Marca, 'Sin marca')} - ${promoterDisplayName(person)}`)
                : monthLabel(this.selected);
            shell('planner', 'Horario por vendedor', subtitle, actions, this.vendorContent());
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
                    <label class="app-search"><span class="material-icons">search</span><input data-search-input="planner-side" value="${h(this.search)}" oninput="mobileApp.setSearch(this.value, this)" placeholder="Buscar persona, marca o proveedor"></label>
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
                    return normalizeSearch(`${promoterDisplayName(person)} ${asText(person.Marca)} ${asText(person.Proveedor)} ${asText(category?.descripcion)}`).includes(normalizeSearch(needle));
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
            const internalMode = this.vendorKind === 'interno';
            return `
                ${monthControls(this.selected, 'mobileApp.changeMonth(-1)', 'mobileApp.changeMonth(1)')}
                <section class="app-filter-stack vendor-filter-stack">
                    <div class="app-segment">
                        <button class="${!internalMode ? 'active' : ''}" onclick="mobileApp.setVendorKind('impulso')">Impulsadoras</button>
                        <button class="${internalMode ? 'active' : ''}" onclick="mobileApp.setVendorKind('interno')">Personal interno</button>
                    </div>
                    <label class="app-search"><span class="material-icons">search</span><input data-search-input="planner-vendor" value="${h(this.search)}" oninput="mobileApp.setSearch(this.value, this)" placeholder="${internalMode ? 'Buscar personal, tienda, codigo o PIN' : 'Buscar vendedor, marca, proveedor, codigo o PIN'}"></label>
                    <button class="mini-chip justify-center" onclick="mobileApp.toggleOnlyAssigned()">${this.onlyAssigned ? 'Solo con turnos' : 'Todos'}</button>
                </section>
                ${this.vendorSelector(people)}
                ${person ? this.vendorSchedule(person) : (people.length ? emptyState('badge', internalMode ? 'Elige personal interno' : 'Elige un vendedor', 'Selecciona una persona para ver su horario mensual.') : '')}
            `;
        }

        vendorPeopleRows() {
            if (this.vendorKind === 'interno') return this.internalVendorPeopleRows();
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
                    return `${normalizeSearch(promoterDisplayName(person))} ${normalizeSearch(person.Marca)} ${normalizeSearch(person.Proveedor)} ${normalizeSearch(person.idVendedor)} ${normalizeSearch(promoterPin(person))} ${normalizeSearch(category?.descripcion)}`.includes(needle);
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

        internalVendorPeopleRows() {
            const rowPersonIds = new Set(this.monthlyInternalRows.map((row) => asInt(row.personal_id)));
            const selectedId = asInt(this.selectedInternalVendorId);
            const needle = normalizeSearch(this.search);
            return this.internalStaff
                .filter((person) => activeInternal(person) || rowPersonIds.has(asInt(person.id)))
                .filter((person) => {
                    const personRows = this.internalVendorScheduleRows(person);
                    if (this.onlyAssigned && !personRows.length) return false;
                    if (!needle) return true;
                    const storeNames = personRows.map((row) => asText(byId(this.stores, row.tienda_id)?.nombre_display)).join(' ');
                    return `${normalizeSearch(person.nombre_completo)} ${normalizeSearch(person.idVendedor || person.idvendedor)} ${normalizeSearch(person.PIN || person.pin)} ${normalizeSearch(storeNames)}`.includes(needle);
                })
                .sort((a, b) => {
                    const aSelected = asInt(a.id) === selectedId;
                    const bSelected = asInt(b.id) === selectedId;
                    if (aSelected !== bSelected) return aSelected ? -1 : 1;
                    const countA = this.internalVendorScheduleRows(a).length;
                    const countB = this.internalVendorScheduleRows(b).length;
                    if (countA !== countB) return countB - countA;
                    return asText(a.nombre_completo).localeCompare(asText(b.nombre_completo));
                });
        }

        vendorSelector(people) {
            if (!people.length) {
                return emptyState('person_search', 'Sin personas visibles', 'Ajusta la busqueda o muestra tambien personas sin turnos.');
            }
            const selected = this.vendorKind === 'interno' ? this.selectedInternalVendorId : this.selectedPromoterId;
            return `
                <div class="section-title-row"><h2>${this.vendorKind === 'interno' ? 'Personal interno' : 'Vendedores'}</h2>${selected ? `<button class="mini-chip" onclick="mobileApp.clearVendorSelection()">Limpiar</button>` : ''}</div>
                ${scrollFrame('vendor-scroll', people.map((person) => this.vendorCard(person)).join(''), 'vendedores')}`;
        }

        vendorCard(person) {
            if (this.vendorKind === 'interno') return this.internalVendorCard(person);
            const selected = promoterIds(person).includes(asInt(this.selectedPromoterId));
            const rowsForPerson = this.vendorScheduleRows(person);
            const storeCount = new Set(rowsForPerson.map((row) => asInt(row.tienda_id))).size;
            return `
                <button class="vendor-card app-card ${selected ? 'active' : ''}" onclick="mobileApp.selectVendor(${asInt(person.id)})">
                    <span class="vendor-avatar">${h(initials(promoterDisplayName(person), 1))}</span>
                    <span class="vendor-card-copy">
                        <strong>${h(promoterDisplayName(person))}</strong>
                        <small>${h(promoterVendorMeta(person))}</small>
                    </span>
                    <span class="vendor-card-stats">
                        ${miniChip(`${rowsForPerson.length} días`, '#E85D75')}
                        ${miniChip(`${storeCount} puntos`, '#0E9F8F')}
                    </span>
                    ${selected ? '<span class="material-icons vendor-card-check">check_circle</span>' : ''}
                </button>`;
        }

        internalVendorCard(person) {
            const selected = asInt(person.id) === asInt(this.selectedInternalVendorId);
            const rowsForPerson = this.internalVendorScheduleRows(person);
            const storeCount = new Set(rowsForPerson.map((row) => asInt(row.tienda_id))).size;
            const primaryStore = byId(this.stores, rowsForPerson[0]?.tienda_id || person?.idBodega || person?.idbodega);
            const tone = internalPersonTone(person, rowsForPerson[0], primaryStore);
            return `
                <button class="vendor-card app-card ${selected ? 'active' : ''}" onclick="mobileApp.selectInternalVendor(${asInt(person.id)})">
                    <span class="vendor-avatar" style="background:${h(tone.avatar)};color:${h(tone.avatarText)}">${h(internalPersonInitials(person))}</span>
                    <span class="vendor-card-copy">
                        <strong>${h(asText(person.nombre_completo, 'Personal'))}</strong>
                        <small>${h(this.internalVendorMeta(person))}</small>
                    </span>
                    <span class="vendor-card-stats">
                        ${miniChip(`${rowsForPerson.length} días`, '#0E9F8F')}
                        ${miniChip(`${storeCount} tiendas`, '#111827')}
                    </span>
                    ${selected ? '<span class="material-icons vendor-card-check">check_circle</span>' : ''}
                </button>`;
        }

        selectedVendor() {
            if (this.vendorKind === 'interno') {
                const selectedId = asInt(this.selectedInternalVendorId);
                if (!selectedId) return null;
                return byId(this.internalStaff, selectedId) || null;
            }
            const selectedId = asInt(this.selectedPromoterId);
            if (!selectedId) return null;
            const direct = byId(this.promoters, selectedId);
            if (!direct) return null;
            return mergePromoterOptions(this.promoters, selectedId)
                .find((person) => promoterIds(person).includes(selectedId)) || direct;
        }

        vendorScheduleRows(person) {
            if (this.vendorKind === 'interno') return this.internalVendorScheduleRows(person);
            if (!person) return [];
            return this.monthlyRows
                .filter((row) => promoterMatchesRow(person, row))
                .sort((a, b) => asText(a.fecha).localeCompare(asText(b.fecha)) || asText(byId(this.stores, a.tienda_id)?.nombre_display).localeCompare(asText(byId(this.stores, b.tienda_id)?.nombre_display)));
        }

        internalVendorScheduleRows(person) {
            if (!person) return [];
            return this.monthlyInternalRows
                .filter((row) => asInt(row.personal_id) === asInt(person.id))
                .sort((a, b) => asText(a.fecha).localeCompare(asText(b.fecha)) || asText(byId(this.stores, a.tienda_id)?.nombre_display).localeCompare(asText(byId(this.stores, b.tienda_id)?.nombre_display)));
        }

        vendorSchedule(person) {
            if (this.vendorKind === 'interno') return this.internalVendorSchedule(person);
            const rowsForPerson = this.vendorScheduleRows(person);
            const storeCount = new Set(rowsForPerson.map((row) => asInt(row.tienda_id))).size;
            return `
                <section class="vendor-schedule-panel">
                    <div class="vendor-schedule-head app-card">
                        <span class="vendor-avatar large">${h(initials(promoterDisplayName(person)))}</span>
                        <span class="flex-1 min-w-0">
                            <strong>${h(promoterDisplayName(person))}</strong>
                            <small>${h(promoterVendorMeta(person))}</small>
                        </span>
                        ${this.canEditVendor() || this.canManagePlanner() ? `
                            <span class="vendor-schedule-actions">
                                ${this.canEditVendor() ? `<button class="planner-icon-btn" title="Editar vendedor" onclick="mobileApp.showVendorEditForm(${asInt(person.id)})"><span class="material-icons">manage_accounts</span></button>` : ''}
                                <button class="planner-icon-btn" title="Asignar día" onclick="mobileApp.showPromoterFormForPerson(${asInt(person.id)}, '${dateKey(this.defaultVendorDate())}')"><span class="material-icons">edit_calendar</span></button>
                            </span>` : ''}
                    </div>
                    <div class="vendor-stat-row">
                        ${this.vendorStat('Dias asignados', rowsForPerson.length, 'event_available', '#E85D75')}
                        ${this.vendorStat('Puntos', storeCount, 'storefront', '#0E9F8F')}
                        ${this.vendorStat('Mes', monthShort[this.selected.getMonth()], 'calendar_month', '#111827')}
                        ${this.vendorStat('PIN', promoterPin(person) || '-', 'pin', '#111827')}
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

        internalVendorSchedule(person) {
            const rowsForPerson = this.internalVendorScheduleRows(person);
            const storeCount = new Set(rowsForPerson.map((row) => asInt(row.tienda_id))).size;
            const primaryStore = byId(this.stores, rowsForPerson[0]?.tienda_id || person?.idBodega || person?.idbodega);
            const tone = internalPersonTone(person, rowsForPerson[0], primaryStore);
            return `
                <section class="vendor-schedule-panel">
                    <div class="vendor-schedule-head app-card">
                        <span class="vendor-avatar large" style="background:${h(tone.avatar)};color:${h(tone.avatarText)}">${h(internalPersonInitials(person))}</span>
                        <span class="flex-1 min-w-0">
                            <strong>${h(asText(person.nombre_completo, 'Personal'))}</strong>
                            <small>${h(this.internalVendorMeta(person))}</small>
                        </span>
                        ${this.canManagePlanner() ? `
                            <span class="vendor-schedule-actions">
                                <button class="planner-icon-btn" title="Asignar día" onclick="mobileApp.showInternalFormForPerson(${asInt(person.id)}, '${dateKey(this.defaultVendorDate())}')"><span class="material-icons">edit_calendar</span></button>
                            </span>` : ''}
                    </div>
                    <div class="vendor-stat-row">
                        ${this.vendorStat('Dias asignados', rowsForPerson.length, 'event_available', '#0E9F8F')}
                        ${this.vendorStat('Tiendas', storeCount, 'storefront', '#111827')}
                        ${this.vendorStat('Mes', monthShort[this.selected.getMonth()], 'calendar_month', '#111827')}
                        ${this.vendorStat('PIN', asText(person.PIN || person.pin, '-'), 'pin', '#111827')}
                    </div>
                    ${calendarBoard({
                        selected: this.selected,
                        rows: rowsForPerson,
                        subtitle: `INTERNO - ${asText(person.nombre_completo, 'Personal')}`,
                        countLabel: 'días',
                        personId: () => asInt(person.id),
                        peopleLabel: () => `${storeCount} tiendas`,
                        dayHandler: 'mobileApp.openVendorDay',
                        cellContent: (dayRows) => `<div>${dayRows.slice(0, 3).map((row) => this.vendorCalendarLabel(row)).join('')}${dayRows.length > 3 ? `<div class="text-[8px] font-black text-[#756c65] mt-1">+${dayRows.length - 3} más</div>` : ''}</div>`
                    })}
                </section>`;
        }

        async ensureBrandCatalog() {
            if (this.brandCatalog?.length) return this.brandCatalog;
            this.brandCatalog = await rows(db.from(tables.brandCatalog).select('*').eq('activo', true).order('marca'));
            return this.brandCatalog;
        }

        usefulValue(value) {
            const text = asText(value).trim();
            return text && text !== '0' ? text : '';
        }

        emailList(value) {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const values = Array.isArray(value) ? value : asText(value).split(/[,;\n]+/);
            const seen = new Set();
            const emails = [];
            values.forEach((item) => {
                const email = asText(item).trim().toLowerCase();
                if (!email || !emailPattern.test(email) || seen.has(email)) return;
                seen.add(email);
                emails.push(email);
            });
            return emails;
        }

        emailListText(value) {
            return this.emailList(value).join(', ');
        }

        brandLabel(brand) {
            return `${asText(brand?.marca, 'Sin marca')} - ${asText(brand?.proveedor, 'Sin proveedor')} (#${asText(brand?.idMarca, '-')})`;
        }

        brandOptionsHtml() {
            return this.brandCatalog.map((brand) => `<option value="${h(this.brandLabel(brand))}"></option>`).join('');
        }

        getBrandByIdMarca(idMarca) {
            const id = asInt(idMarca);
            if (!id) return null;
            return this.brandCatalog.find((brand) => asInt(brand.idMarca) === id) || null;
        }

        getUniqueBrandByName(name) {
            const normalized = normalizeSearch(name);
            if (!normalized) return null;
            const matches = this.brandCatalog.filter((brand) => normalizeSearch(brand.marca) === normalized);
            return matches.length === 1 ? matches[0] : null;
        }

        getPersonBrand(person) {
            return this.getBrandByIdMarca(person?.idMarca) || this.getUniqueBrandByName(person?.Marca);
        }

        resolveBrandInput(value) {
            const rawValue = asText(value).trim();
            if (!rawValue) return null;
            const idMatch = rawValue.match(/#(\d+)/);
            if (idMatch) return this.getBrandByIdMarca(idMatch[1]);
            const normalizedValue = normalizeSearch(rawValue);
            return this.brandCatalog.find((brand) => normalizeSearch(this.brandLabel(brand)) === normalizedValue)
                || this.getUniqueBrandByName(rawValue);
        }

        getProviderEmails(idProveedor) {
            const providerId = asInt(idProveedor);
            if (!providerId) return [];
            const catalogEmails = this.brandCatalog
                .filter((brand) => asInt(brand.idProveedor) === providerId)
                .flatMap((brand) => [
                    ...this.emailList(brand.correos_proveedor),
                    ...this.emailList(brand.correo_proveedor),
                ]);
            const normalizedCatalogEmails = this.emailList(catalogEmails);
            if (normalizedCatalogEmails.length) return normalizedCatalogEmails;
            return this.emailList(this.promoters
                .filter((person) => asInt(person.idProveedor) === providerId)
                .flatMap((person) => this.emailList(person.Correo)));
        }

        getProviderEmail(idProveedor) {
            return this.getProviderEmails(idProveedor).join(', ');
        }

        vendorBrandFormHtml(person) {
            const brand = this.getPersonBrand(person);
            const initialBrand = brand ? this.brandLabel(brand) : '';
            const providerText = brand?.proveedor || this.usefulValue(person.Proveedor) || 'Selecciona una marca registrada';
            const emailValue = brand ? this.getProviderEmail(brand.idProveedor) : this.emailListText(person.Correo);
            return `
                <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1">Marca registrada *</label>
                    <input type="text" id="swal-brand-search" list="swal-brand-options" class="w-full p-3 border rounded-xl" value="${h(initialBrand)}" placeholder="Buscar marca o proveedor">
                    <datalist id="swal-brand-options">${this.brandOptionsHtml()}</datalist>
                    <div id="swal-brand-provider" class="mt-2 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-500">${h(providerText)}</div>
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1">Correos del proveedor</label>
                    <textarea id="swal-correo" class="w-full min-h-[86px] p-3 border rounded-xl resize-none" placeholder="correo@proveedor.com, otro@proveedor.com">${h(emailValue)}</textarea>
                </div>`;
        }

        bindVendorBrandPicker() {
            const input = document.getElementById('swal-brand-search');
            const providerEl = document.getElementById('swal-brand-provider');
            const emailInput = document.getElementById('swal-correo');
            if (!input || !providerEl || !emailInput) return;

            const renderBrand = () => {
                const brand = this.resolveBrandInput(input.value);
                if (!brand) {
                    providerEl.textContent = 'Elige una marca de la lista para asociar proveedor e IDs internos.';
                    providerEl.className = 'mt-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700';
                    return;
                }
                providerEl.innerHTML = `
                    <div class="font-bold text-slate-700">${h(asText(brand.proveedor, 'Sin proveedor'))}</div>
                    <div>ID marca ${h(asText(brand.idMarca))} · ID proveedor ${h(asText(brand.idProveedor))}</div>`;
                providerEl.className = 'mt-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-700';
                const providerEmail = this.getProviderEmail(brand.idProveedor);
                if (providerEmail) emailInput.value = providerEmail;
            };

            input.addEventListener('input', renderBrand);
            renderBrand();
        }

        readVendorBrandSelection() {
            const brand = this.resolveBrandInput(document.getElementById('swal-brand-search')?.value);
            const correoRaw = asText(document.getElementById('swal-correo')?.value).trim();
            const correos = this.emailList(correoRaw);
            if (!brand) {
                Swal.showValidationMessage('Selecciona una marca registrada de la lista.');
                return null;
            }
            if (correoRaw && !correos.length) {
                Swal.showValidationMessage('Escribe al menos un correo válido para el proveedor.');
                return null;
            }
            const invalidEmails = correoRaw.split(/[,;\n]+/)
                .map((email) => email.trim())
                .filter((email) => email && !this.emailList(email).length);
            if (invalidEmails.length) {
                Swal.showValidationMessage(`Correo no válido: ${invalidEmails[0]}`);
                return null;
            }
            return { brand, correo: correos.join(', '), correos };
        }

        promoterBrandPayload(brand, correos) {
            const emailText = this.emailListText(correos?.length ? correos : this.getProviderEmails(brand.idProveedor));
            return {
                Marca: brand.marca || null,
                idMarca: asInt(brand.idMarca) || null,
                Proveedor: brand.proveedor || null,
                idProveedor: asInt(brand.idProveedor) || null,
                Correo: emailText || this.emailListText(brand.correo_proveedor) || null
            };
        }

        async syncProviderEmail(idProveedor, correos) {
            const providerId = asInt(idProveedor);
            const emailList = this.emailList(correos);
            if (!providerId || !emailList.length) return;
            const emailText = emailList.join(', ');
            const timestamp = new Date().toISOString();
            const { error: catalogError } = await db.from(tables.brandCatalog)
                .update({ correo_proveedor: emailList[0], correos_proveedor: emailList, actualizado_en: timestamp })
                .eq('idProveedor', providerId);
            if (catalogError) console.warn('No se pudo sincronizar correo del proveedor:', catalogError);
            const { error: staffError } = await db.from(tables.impulsadoras)
                .update({ Correo: emailText })
                .eq('idProveedor', providerId);
            if (staffError) console.warn('No se pudo sincronizar correo en impulsadoras:', staffError);
        }

        internalVendorMeta(person) {
            const code = asText(person?.idVendedor || person?.idvendedor, '-');
            const pin = asText(person?.PIN || person?.pin, '-');
            return `Codigo ${code} - PIN ${pin}`;
        }

        async showVendorEditForm(personId) {
            if (!this.canEditVendor()) return;
            const person = byId(this.promoters, personId);
            if (!person) return;
            let value;
            try {
                await this.ensureBrandCatalog();
                const categoryOptions = this.categories.map((category) =>
                    `<option value="${asInt(category.id)}" ${asInt(category.id) === asInt(person.idCategoria) ? 'selected' : ''}>${h(asText(category.descripcion))}</option>`
                ).join('');
                const active = person.Habilitado !== false;
                const result = await Swal.fire({
                    title: 'Editar vendedor',
                    html: `
                        <div class="text-left space-y-3">
                            <div class="bg-slate-100 p-3 rounded-xl">
                                <label class="block text-xs font-bold text-slate-500 mb-1">PIN (no editable)</label>
                                <div class="font-mono font-bold text-slate-800">${h(promoterPin(person) || '-')}</div>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-slate-500 mb-1">Nombre completo *</label>
                                <input type="text" id="swal-nombre" class="w-full p-3 border rounded-xl" value="${h(asText(person.nombre_completo))}">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-slate-500 mb-1">Código de venta *</label>
                                <input type="text" id="swal-codigo" class="w-full p-3 border rounded-xl" value="${h(asText(person.idVendedor))}" inputmode="numeric">
                            </div>
                            ${this.vendorBrandFormHtml(person)}
                            <div>
                                <label class="block text-xs font-bold text-slate-500 mb-1">Categoría</label>
                                <select id="swal-categoria" class="w-full p-3 border rounded-xl">
                                    <option value="">Sin categoría</option>
                                    ${categoryOptions}
                                </select>
                            </div>
                            <label class="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-sm font-bold text-slate-600">
                                <input type="checkbox" id="swal-habilitado" ${active ? 'checked' : ''}>
                                Vendedor activo
                            </label>
                        </div>`,
                    showCancelButton: true,
                    confirmButtonText: 'Guardar',
                    cancelButtonText: 'Cancelar',
                    didOpen: () => this.bindVendorBrandPicker(),
                    preConfirm: () => {
                        const name = asText(document.getElementById('swal-nombre')?.value).trim();
                        const code = asText(document.getElementById('swal-codigo')?.value).trim();
                        const brandSelection = this.readVendorBrandSelection();
                        if (!name || !/^\d+$/.test(code) || !brandSelection) {
                            Swal.showValidationMessage('Nombre, código numérico y marca registrada son requeridos.');
                            return false;
                        }
                        return {
                            data: {
                                nombre_completo: name,
                                idVendedor: asInt(code),
                                ...this.promoterBrandPayload(brandSelection.brand, brandSelection.correos),
                                idCategoria: asInt(document.getElementById('swal-categoria')?.value) || null,
                                Habilitado: document.getElementById('swal-habilitado')?.checked === true
                            },
                            providerId: brandSelection.brand.idProveedor,
                            providerEmail: brandSelection.correos
                        };
                    }
                });
                value = result.value;
            } catch (error) {
                Swal.fire('Error', error.message || 'No se pudo cargar el formulario del vendedor', 'error');
                return;
            }
            if (!value) return;
            try {
                await rows(db.from(tables.impulsadoras).update(value.data).eq('id', asInt(person.id)).select());
                await this.syncProviderEmail(value.providerId, value.providerEmail);
                this.selectedPromoterId = asInt(person.id);
                await this.reload();
                Swal.fire({ icon: 'success', title: 'Vendedor actualizado', timer: 1400, showConfirmButton: false });
            } catch (error) {
                Swal.fire('Error', error.message || 'No se pudo guardar el vendedor', 'error');
            }
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
                    <label class="app-search"><span class="material-icons">search</span><input data-search-input="planner-monthly" value="${h(this.search)}" oninput="mobileApp.setSearch(this.value, this)" placeholder="Buscar nombre, marca o proveedor"></label>
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
                    collapsible: true,
                    emptyIcon: 'calendar_month',
                    emptyTitle: 'Sin fechas pendientes',
                    emptyMessage: 'No hay días desde hoy que coincidan con los filtros.',
                    daySubtitle: (count) => `${count} ${count === 1 ? 'asignación' : 'asignaciones'}`,
                    addHandler: this.canManagePlanner() ? 'mobileApp.openPromoterSheetForDate' : '',
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
                    return normalizeSearch(`${promoterDisplayName(person)} ${asText(person.Marca)} ${asText(person.Proveedor)} ${asText(store?.nombre_display)} ${asText(store?.alias_tienda)} ${asText(category?.descripcion)}`).includes(normalizeSearch(needle));
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
                html: `<p class="text-slate-500 mb-3">${dayRows.length} ${dayRows.length === 1 ? 'asignación' : 'asignaciones'}</p>${dayRows.length ? dayRows.map((row) => this.promoterAgendaRow(row)).join('') : emptyState('event_available', 'Día libre', 'No hay personal asignado en esta fecha.')}${this.canManagePlanner() ? `<button class="bottom-action mt-3" onclick="Swal.close(); mobileApp.openPromoterSheetForDate('${key}')">Asignar este día</button>` : ''}`,
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
            if (!this.canManagePlanner()) return;
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
                if (row) {
                    if (this.canManagePlanner()) {
                        this.openInternalSheet(row);
                        return;
                    }
                    const person = byId(this.internalStaff, row.personal_id);
                    const store = byId(this.stores, row.tienda_id);
                    Swal.fire({
                        title: asText(person?.nombre_completo, 'Personal interno'),
                        html: `<p class="text-slate-500 mb-2">${h(asText(store?.nombre_display, 'Bodega/Tienda'))}</p><p class="font-bold">${h(asText(row.tipo, 'TRABAJO'))} - ${h(asText(row.fecha))}</p>`,
                        showConfirmButton: false,
                        showCloseButton: true
                    });
                }
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
                        ${this.canManagePlanner() ? `<button class="bottom-action full" onclick="Swal.close(); mobileApp.openPromoterSheet(${asInt(row.id)})">Modificar asignación</button><button class="bottom-action ink full" onclick="Swal.close(); mobileApp.deletePromoter(${asInt(row.id)})">Eliminar</button>` : ''}
                        ${this.canReportFromPlanner() ? `<button class="bottom-action teal full" onclick="Swal.close(); mobileApp.reportIncident(${asInt(row.id)})">Reportar incidencia</button>` : ''}
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
            this.vendorKind = 'impulso';
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

        setVendorKind(kind) {
            this.vendorKind = kind === 'interno' ? 'interno' : 'impulso';
            this.render();
        }

        selectVendor(id) {
            this.vendorKind = 'impulso';
            this.selectedPromoterId = asInt(id) || null;
            this.render();
        }

        selectInternalVendor(id) {
            this.vendorKind = 'interno';
            this.selectedInternalVendorId = asInt(id) || null;
            this.render();
        }

        clearVendorSelection() {
            this.selectedPromoterId = null;
            this.selectedInternalVendorId = null;
            this.render();
        }

        openVendorDay(key) {
            const person = this.selectedVendor();
            if (!person) return;
            if (this.vendorKind === 'interno') {
                const rowsForDay = this.internalVendorScheduleRows(person).filter((row) => asText(row.fecha) === key);
                if (rowsForDay.length) {
                    this.showInternalForm(rowsForDay[0], parseDate(rowsForDay[0].fecha), rowsForDay[0].tienda_id, asInt(person.id));
                    return;
                }
                if (this.canManagePlanner()) this.showInternalFormForPerson(asInt(person.id), key);
                return;
            }
            const rowsForDay = this.vendorScheduleRows(person).filter((row) => asText(row.fecha) === key);
            if (rowsForDay.length) {
                this.openEntryActions('impulso', asInt(rowsForDay[0].id));
                return;
            }
            if (this.canManagePlanner()) this.showPromoterFormForPerson(asInt(person.id), key);
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

        async reportIncident(id, options = {}) {
            const incidentOptions = options.incidentOptions || plannerIncidentOptions;
            const notePlaceholder = options.notePlaceholder || 'Observación';
            const { value } = await Swal.fire({
                title: options.title || 'Reportar incidencia',
                html: `
                    <div class="grid gap-3 text-left">
                        <select id="mw-subject" class="w-full p-3 border rounded-xl">
                            ${incidentOptions.map(([value, label]) => `<option value="${h(value)}">${h(label)}</option>`).join('')}
                        </select>
                        <textarea id="mw-note" rows="3" class="w-full p-3 border rounded-xl resize-none" placeholder="${h(notePlaceholder)}"></textarea>
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

        openInternalSheet(existing) {
            this.showInternalForm(existing, existing ? parseDate(existing.fecha) : this.selected, this.assignmentStoreHint());
        }

        async showInternalForm(existing, date, forcedStoreId, forcedPersonId = null) {
            const activeStaff = this.internalStaff
                .filter((person) => activeInternal(person) || asInt(person.id) === asInt(existing?.personal_id) || asInt(person.id) === asInt(forcedPersonId))
                .sort((a, b) => asText(a.nombre_completo).localeCompare(asText(b.nombre_completo)));
            const activeStores = this.stores
                .filter((store) => store.activo !== false || asInt(store.id) === asInt(existing?.tienda_id))
                .filter((store) => !this.session.isStoreUser || asInt(store.id) === this.session.storeId);
            const currentDate = dateKey(date || this.selected);
            const currentPerson = asInt(existing?.personal_id || forcedPersonId, '');
            const currentStore = asInt(existing?.tienda_id || forcedStoreId || this.session.storeId || '', '');
            const currentType = asText(existing?.tipo, 'TRABAJO');
            const canDeleteExisting = Boolean(existing?.id)
                && typeof this.deleteInternalAssignment === 'function'
                && (this.session.isManager || (this.session.isStoreUser && asInt(existing.tienda_id) === asInt(this.session.storeId)));
            const result = await Swal.fire({
                title: existing ? 'Modificar asignación' : 'Nueva asignación',
                html: `
                    <div class="grid gap-3 text-left">
                        <label class="text-xs font-bold text-slate-500">Fecha<input id="mw-date" type="date" class="w-full p-3 border rounded-xl mt-1" value="${currentDate}"></label>
                        <label class="text-xs font-bold text-slate-500">Personal<select id="mw-person" class="w-full p-3 border rounded-xl mt-1"><option value="">Seleccionar</option>${activeStaff.map((person) => `<option value="${asInt(person.id)}" ${asInt(person.id) === currentPerson ? 'selected' : ''}>${h(asText(person.nombre_completo))}</option>`).join('')}</select></label>
                        <label class="text-xs font-bold text-slate-500">Bodega/Tienda<select id="mw-store" class="mw-store-color-select w-full p-3 border rounded-xl mt-1" style="${storePickerStyle(byId(activeStores, currentStore))}" onchange="mobileApp.paintStorePicker(this)" ${this.session.isStoreUser ? 'disabled' : ''}><option value="">Seleccionar</option>${activeStores.map((store) => `<option value="${asInt(store.id)}" ${asInt(store.id) === currentStore ? 'selected' : ''}>${h(asText(store.nombre_display))}</option>`).join('')}</select></label>
                        <label class="text-xs font-bold text-slate-500">Tipo<select id="mw-type" class="w-full p-3 border rounded-xl mt-1">${['TRABAJO', 'VACACIONES', 'PERMISO', 'LICENCIA'].map((type) => `<option value="${type}" ${type === currentType ? 'selected' : ''}>${type}</option>`).join('')}</select></label>
                    </div>`,
                showCancelButton: true,
                showDenyButton: canDeleteExisting,
                confirmButtonText: 'Guardar',
                denyButtonText: 'Eliminar asignación',
                denyButtonColor: '#111827',
                didOpen: () => this.paintStorePicker(document.getElementById('mw-store')),
                preConfirm: () => ({
                    fecha: document.getElementById('mw-date').value,
                    personal_id: asInt(document.getElementById('mw-person').value),
                    tienda_id: asInt(document.getElementById('mw-store').value || currentStore),
                    tipo: document.getElementById('mw-type').value
                })
            });
            if (result.isDenied) {
                await this.deleteInternalAssignment(asInt(existing.id));
                return;
            }
            const value = result.value;
            if (!value) return;
            if (!value.fecha || !value.personal_id || !value.tienda_id) {
                Swal.fire('Faltan datos', 'Selecciona fecha, personal y tienda.', 'warning');
                return;
            }
            const localConflict = this.internalRows.find((row) => asInt(row.personal_id) === value.personal_id && asText(row.fecha) === value.fecha && asInt(row.id) !== asInt(existing?.id));
            const remoteConflict = localConflict || await this.findInternalAssignmentConflict(value, existing);
            if (remoteConflict) {
                this.showInternalAssignmentConflict(value, remoteConflict);
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

        async findInternalAssignmentConflict(value, existing) {
            let query = db.from(tables.internalSchedule)
                .select('id,fecha,personal_id,tienda_id,tipo')
                .eq('personal_id', value.personal_id)
                .eq('fecha', value.fecha)
                .limit(1);
            if (existing?.id) query = query.neq('id', asInt(existing.id));
            const conflicts = await rows(query);
            return conflicts[0] || null;
        }

        showInternalAssignmentConflict(value, conflict) {
            const person = byId(this.internalStaff, value.personal_id);
            const store = byId(this.stores, conflict.tienda_id);
            Swal.fire({
                icon: 'warning',
                title: 'Asignación duplicada',
                text: `${asText(person?.nombre_completo, 'Ese personal')} ya está asignado en ${asText(store?.nombre_display, 'otra tienda')} el ${asText(value.fecha)}. Modifica o elimina esa asignación antes de moverlo.`
            });
        }

        showInternalFormForPerson(personId, key) {
            this.showInternalForm(null, parseDate(key) || this.defaultVendorDate(), this.assignmentStoreHint(), asInt(personId));
        }
    }

    class StoreMonthView extends BaseView {
        constructor() {
            super('store');
            const params = pageParams();
            const linkedDate = parseDate(params.get('date'));
            this.selected = monthStart(linkedDate || new Date());
            this.selectedStoreId = asInt(params.get('store'), null);
            this.search = '';
            this.onlyAssigned = true;
            this.stores = [];
            this.promoters = [];
            this.categories = [];
            this.monthlyRows = [];
            this.monthlyInternalRows = [];
            this.internalRows = [];
            this.todayRows = [];
            this.attendanceRows = [];
            this.messageRows = [];
            this.messageStates = [];
            this.assignmentFilter = 'all';
            this.exitFeatureAvailable = false;
        }

        async load() {
            await this.loadBase();
            const todayKey = todayKeyInGuayaquil();
            const [monthlyRows, monthlyInternalRows, todayRows, attendanceRows, exitFeatureAvailable, inboxRows] = await Promise.all([
                this.monthlyPromoterAssignments(this.selected),
                this.monthlyInternalAssignments(this.selected),
                this.promoterAssignmentsForKey(todayKey),
                this.attendanceForKey(todayKey),
                this.checkExitFeature(),
                this.session.isStoreUser ? this.loadInboxRows() : Promise.resolve([[], []])
            ]);
            this.monthlyRows = monthlyRows;
            this.monthlyInternalRows = monthlyInternalRows;
            this.internalRows = monthlyInternalRows;
            this.todayRows = todayRows;
            this.attendanceRows = attendanceRows;
            this.exitFeatureAvailable = exitFeatureAvailable;
            this.messageRows = inboxRows[0] || [];
            this.messageStates = inboxRows[1] || [];
            if (this.selectedStoreId && !byId(this.stores, this.selectedStoreId)) this.selectedStoreId = null;
            if (this.session.isStoreUser) this.selectedStoreId = this.session.storeId;
            if (!this.selectedStoreId && this.stores.length) this.selectedStoreId = asInt(this.stores[0].id);
        }

        async loadInboxRows() {
            const userId = asInt(sessionStorage.getItem('staffPlannerUserId'));
            return Promise.all([
                messageRows(db.from(tables.messages).select('*').eq('activo', true).order('creado_en', { ascending: false })),
                userId ? messageRows(db.from(tables.messageStates).select('*').eq('usuario_id', userId)) : Promise.resolve([])
            ]);
        }

        async checkExitFeature() {
            try {
                const { error } = await db.from(tables.attendance).select('salida_en').limit(1);
                if (error) return false;
                const response = await fetch(`${window.StaffPlanner.supabaseUrl}/functions/v1/mark-store-exit`, {
                    method: 'OPTIONS',
                    headers: { apikey: window.StaffPlanner.supabaseKey }
                });
                return response.ok;
            } catch (error) {
                return false;
            }
        }

        render() {
            const store = byId(this.stores, this.selectedStoreId);
            shell('store', 'Tienda', this.selectedStoreId ? `${asText(store?.nombre_display, 'Punto de venta')} - ${monthLabel(this.selected)}` : 'Selecciona un punto de venta', iconButton('refresh', 'mobileApp.reload()', 'Actualizar'), this.content());
        }

        content() {
            const rowsForStore = this.visibleRows();
            const attendanceSection = this.selectedStoreId && this.assignmentFilter !== 'interno' ? this.todayDashboardSection() : '';
            return `
                ${attendanceSection}
                ${monthControls(this.selected, 'mobileApp.changeMonth(-1)', 'mobileApp.changeMonth(1)')}
                ${this.filters()}
                ${this.selectedStoreId ? calendarBoard({
                    selected: this.selected,
                    rows: rowsForStore,
                    badge: storeBadge(byId(this.stores, this.selectedStoreId), 48),
                    subtitle: asText(byId(this.stores, this.selectedStoreId)?.nombre_display, 'Tienda'),
                    countLabel: this.storeCountLabel(),
                    personId: (row) => this.rowPersonKey(row),
                    peopleLabel: (people) => `${people} personas`,
                    dayHandler: 'mobileApp.openDaySheet',
                    cellContent: (dayRows) => this.calendarCellContent(dayRows)
                }) + agendaList({
                    selected: this.selected,
                    rows: rowsForStore,
                    onlyAssigned: this.onlyAssigned,
                    collapsible: true,
                    emptyIcon: 'person_off',
                    emptyTitle: this.storeEmptyTitle(),
                    emptyMessage: this.storeEmptyMessage(),
                    daySubtitle: (count) => this.storeDaySubtitle(count),
                    addHandler: this.storePrimaryAddHandler(),
                    row: (row) => this.assignmentRow(row)
                }) : emptyState('storefront', 'Elige una tienda', 'Verás el calendario mensual de personal asignado.')}
            `;
        }

        todayDashboardSection() {
            const attendance = this.attendanceTodaySection();
            if (!this.session.isStoreUser) return attendance;
            return `
                <section class="store-today-layout">
                    ${this.messageInboxPanel()}
                    ${attendance}
                </section>`;
        }

        pendingMessageEntries() {
            return messageOccurrenceEntries(this.messageRows, this.messageStates, false);
        }

        messageEntryByKey(messageId, occurrenceKey, archived = false) {
            return messageOccurrenceEntries(this.messageRows, this.messageStates, archived)
                .find((entry) => asInt(entry.message.id) === asInt(messageId) && asText(entry.occurrenceKey) === asText(occurrenceKey));
        }

        messageInboxPanel() {
            const entries = this.pendingMessageEntries();
            const visible = entries.slice(0, 4);
            return `
                <section class="message-panel app-card">
                    <div class="message-panel-head">
                        <span class="material-icons">inbox</span>
                        <span class="min-w-0">
                            <strong>Buzón de Mensajes</strong>
                            <small>${entries.length ? `${entries.length} pendiente${entries.length === 1 ? '' : 's'}` : 'Sin pendientes'}</small>
                        </span>
                        <a class="message-panel-link" href="mensajes.html" title="Abrir buzón"><span class="material-icons">open_in_new</span></a>
                    </div>
                    ${visible.length ? visible.map((entry) => this.messageInboxItem(entry)).join('') : emptyState('mark_email_read', 'Buzón al día', 'No tienes mensajes pendientes.')}
                    ${entries.length > visible.length ? `<a class="message-more-link" href="mensajes.html">+${entries.length - visible.length} pendientes más</a>` : ''}
                </section>`;
        }

        messageInboxItem(entry) {
            const action = messageActionLabel(entry.message);
            return `
                <article class="message-inbox-item" onclick="mobileApp.openStoreMessage(${asInt(entry.message.id)}, '${h(entry.occurrenceKey)}')">
                    <span class="message-item-icon"><span class="material-icons">${messageKindIcon(entry.message)}</span></span>
                    <span class="min-w-0">
                        <strong>${h(messageEntryTitle(entry))}</strong>
                        <small>${h(messagePreview(entry.message))}</small>
                        ${messageDueBadge(entry)}
                    </span>
                    <button type="button" class="message-check-btn" title="${h(action)}" aria-label="${h(action)}" onclick="event.stopPropagation(); mobileApp.markStoreMessage(${asInt(entry.message.id)}, '${h(entry.occurrenceKey)}')">
                        <span class="material-icons">${messageActionIcon(entry.message)}</span>
                    </button>
                </article>`;
        }

        async openStoreMessage(messageId, occurrenceKey) {
            const entry = this.messageEntryByKey(messageId, occurrenceKey, false)
                || this.messageEntryByKey(messageId, occurrenceKey, true);
            if (!entry) return;
            const archived = isMessageArchived(entry.message, entry.state);
            const result = await Swal.fire({
                title: messageEntryTitle(entry),
                html: messageDetailHtml(entry),
                showCloseButton: true,
                showCancelButton: !archived,
                showConfirmButton: !archived,
                confirmButtonText: messageActionLabel(entry.message),
                cancelButtonText: 'Cerrar'
            });
            if (result.isConfirmed) await this.markStoreMessage(messageId, occurrenceKey);
        }

        async markStoreMessage(messageId, occurrenceKey) {
            const entry = this.messageEntryByKey(messageId, occurrenceKey, false);
            if (!entry) return;
            try {
                await archiveMessageEntry(entry);
                await this.reload();
                Swal.fire({ icon: 'success', title: messageAction(entry.message) === 'completado' ? 'Tarea completada' : 'Mensaje archivado', timer: 1300, showConfirmButton: false });
            } catch (error) {
                Swal.fire('Error', error.message || 'No se pudo actualizar el mensaje', 'error');
            }
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

        lunchDuration(attendance) {
            return attendanceLunchMinutes(attendance);
        }

        lunchBadge(attendance) {
            const out = timeInGuayaquil(attendance?.almuerzo_salida_en);
            const back = timeInGuayaquil(attendance?.almuerzo_ingreso_en);
            if (!out) return '';
            if (!back) {
                return `<span class="attendance-lunch-pill active"><span class="material-icons">lunch_dining</span>Almuerzo desde ${h(out)}</span>`;
            }
            const minutes = this.lunchDuration(attendance);
            const duration = minutes === null ? '' : ` - ${minutes} min`;
            return `<span class="attendance-lunch-pill complete"><span class="material-icons">timer</span>${h(`${out} a ${back}${duration}`)}</span>`;
        }

        exitBadge(attendance) {
            const out = timeInGuayaquil(attendance?.salida_en);
            if (!out) return '';
            return `<span class="attendance-exit-pill"><span class="material-icons">logout</span>Salida ${h(out)}</span>`;
        }

        lunchButton(row, attendance, state) {
            if (state.className !== 'approved') return '';
            if (!attendance?.almuerzo_salida_en) {
                return `<button class="attendance-lunch-btn" onclick="mobileApp.markLunch(${asInt(row.id)}, 'salida')">Marcar salida al almuerzo</button>`;
            }
            if (!attendance?.almuerzo_ingreso_en) {
                return `<button class="attendance-lunch-btn return" onclick="mobileApp.markLunch(${asInt(row.id)}, 'ingreso')">Marcar entrada del almuerzo</button>`;
            }
            return '';
        }

        exitButton(row, attendance, state) {
            if (state.className !== 'approved' || !attendance?.almuerzo_ingreso_en || attendance?.salida_en) return '';
            return `<button class="attendance-exit-btn" onclick="mobileApp.markExit(${asInt(row.id)})">Marcar salida</button>`;
        }

        attendancePrimaryButton(row, attendance, state) {
            if (state.className === 'pending') {
                return `<button class="attendance-approve-btn" onclick="mobileApp.approveAttendance(${asInt(row.id)})">Registrar ingreso</button>`;
            }
            return this.lunchButton(row, attendance, state) || this.exitButton(row, attendance, state);
        }

        incidentButton(row) {
            return `
                <button class="attendance-incident-btn" title="Reportar incidencia/observación" aria-label="Reportar incidencia u observación" onclick="mobileApp.reportAttendanceIncident(${asInt(row.id)})">
                    <span class="material-icons">assignment_late</span>
                </button>`;
        }

        attendanceDetailIcon(attendance, state) {
            if (attendance?.almuerzo_salida_en && !attendance?.almuerzo_ingreso_en) return 'lunch_dining';
            if (attendance?.salida_en) return 'logout';
            if (state.className === 'closed') return 'warning_amber';
            return 'visibility';
        }

        attendanceDetailClass(attendance, state) {
            if (attendance?.almuerzo_salida_en && !attendance?.almuerzo_ingreso_en) return 'lunch';
            if (attendance?.salida_en) return 'exited';
            return state.className;
        }

        attendanceDetailButton(row, attendance, state) {
            const icon = this.attendanceDetailIcon(attendance, state);
            const className = this.attendanceDetailClass(attendance, state);
            return `
                <button type="button" class="attendance-detail-btn ${className}" title="Ver desglose de asistencia" aria-label="Ver desglose de asistencia" onclick="mobileApp.showAttendanceDetail(${asInt(row.id)})">
                    <span class="material-icons">${icon}</span>
                </button>`;
        }

        attendanceRow(row) {
            const person = byId(this.promoters, row.impulsadora_id);
            const category = byId(this.categories, person?.idCategoria) || byId(this.categories, row.categoria_asignada_id);
            const attendance = this.attendanceForSchedule(row.id);
            const state = this.attendanceState(attendance);
            const approvedAt = timeInGuayaquil(attendance?.aprobado_en);
            const approvedLabel = approvedAt ? ` - ${approvedAt}` : '';
            const primaryAction = this.attendancePrimaryButton(row, attendance, state);
            const actions = [
                primaryAction,
                this.attendanceDetailButton(row, attendance, state),
                this.incidentButton(row)
            ].filter(Boolean).join('');
            return `
                <article class="attendance-row">
                    ${storeBadge(byId(this.stores, this.selectedStoreId), 38)}
                    <span class="flex-1 min-w-0">
                        <span class="app-list-title block truncate text-[#e85d75]">${h(asText(person?.Marca, 'Sin marca'))}</span>
                        <span class="app-list-title block truncate">${h(person ? promoterDisplayName(person) : 'Personal')}</span>
                        <span class="app-list-subtitle block truncate">${category ? h(asText(category.descripcion)) : 'Sin categoria'}</span>
                    </span>
                    <span class="attendance-meta">
                        <span class="attendance-status ${state.className}"><span class="material-icons">${state.icon}</span>${h(state.label + approvedLabel)}</span>
                        ${this.lunchBadge(attendance)}
                        ${this.exitBadge(attendance)}
                    </span>
                    ${actions ? `<span class="attendance-actions">${actions}</span>` : ''}
                </article>`;
        }

        reportAttendanceIncident(id) {
            return PlannerView.prototype.reportIncident.call(this, id, {
                title: 'Reportar incidencia/observación',
                incidentOptions: storeIncidentOptions,
                notePlaceholder: 'Observación del punto de venta'
            });
        }

        async incidentsForSchedule(id) {
            if (!tables.incidences) return [];
            try {
                return await rows(db.from(tables.incidences).select('*').eq('id_horario', asInt(id)).order('creado_en', { ascending: false }));
            } catch (error) {
                console.error('No se pudieron cargar incidencias del turno:', error);
                return [];
            }
        }

        attendanceCurrentLabel(attendance, state) {
            const lunchOut = timeInGuayaquil(attendance?.almuerzo_salida_en);
            const lunchBack = timeInGuayaquil(attendance?.almuerzo_ingreso_en);
            const exit = timeInGuayaquil(attendance?.salida_en);
            if (state.className === 'approved' && lunchOut && !lunchBack) return `En almuerzo desde ${lunchOut}`;
            if (state.className === 'approved' && exit) return `Salida marcada - ${exit}`;
            if (state.className === 'approved' && lunchBack) return `Regresó del almuerzo - ${lunchBack}`;
            return state.label;
        }

        attendanceDetailHtml(row, attendance, incidents) {
            const person = byId(this.promoters, row.impulsadora_id);
            const store = byId(this.stores, row.tienda_id || this.selectedStoreId);
            const category = byId(this.categories, person?.idCategoria) || byId(this.categories, row.categoria_asignada_id);
            const state = this.attendanceState(attendance);
            const lunchMinutes = attendanceLunchMinutes(attendance);
            const field = (label, value) => `
                <div class="attendance-detail-field">
                    <span>${h(label)}</span>
                    <strong>${h(value || '-')}</strong>
                </div>`;
            const timeline = [
                ['Ingreso', timeInGuayaquil(attendance?.aprobado_en), 'how_to_reg'],
                ['Salida al almuerzo', timeInGuayaquil(attendance?.almuerzo_salida_en), 'lunch_dining'],
                ['Ingreso del almuerzo', timeInGuayaquil(attendance?.almuerzo_ingreso_en), 'restaurant'],
                ['Salida', timeInGuayaquil(attendance?.salida_en), 'logout']
            ].map(([label, value, icon]) => `
                <div class="attendance-timeline-item ${value ? 'done' : ''}">
                    <span class="material-icons">${icon}</span>
                    <span>
                        <strong>${h(label)}</strong>
                        <small>${h(value || 'Pendiente')}</small>
                    </span>
                </div>`).join('');
            const incidentHtml = incidents.length
                ? incidents.map((incident) => `
                    <article class="attendance-incident-detail">
                        <strong>${h(asText(incident.asunto, 'Incidencia'))}</strong>
                        <small>${h(dateTimeInGuayaquil(incident.creado_en))}</small>
                        <p>${h(asText(incident.observacion, 'Sin observación'))}</p>
                    </article>`).join('')
                : `<div class="attendance-detail-empty"><span class="material-icons">task_alt</span><strong>Sin incidencias reportadas</strong></div>`;
            return `
                <div class="attendance-detail-modal text-left">
                    <p class="app-list-subtitle mb-3">${h(asText(store?.nombre_display, 'Tienda'))} - ${h(asText(row.fecha))}</p>
                    <div class="attendance-detail-person">
                        ${storeBadge(store, 42)}
                        <span class="min-w-0">
                            <strong>${h(person ? promoterDisplayName(person) : 'Personal')}</strong>
                            <small>${h(asText(person?.Marca, 'Sin marca'))} - ${h(category ? asText(category.descripcion) : 'Sin categoria')}</small>
                        </span>
                    </div>
                    <div class="attendance-timeline">${timeline}</div>
                    ${field('Estado actual', this.attendanceCurrentLabel(attendance, state))}
                    ${field('Tiempo de almuerzo', lunchMinutes === null ? '' : `${lunchMinutes} min`)}
                    ${field('Aprobado por', attendance?.aprobado_por ? `Usuario #${attendance.aprobado_por}` : '')}
                    ${field('Cierre', dateTimeInGuayaquil(attendance?.cerrado_en))}
                    ${field('Ultima actualización', dateTimeInGuayaquil(attendance?.actualizado_en))}
                    <div class="attendance-detail-section">
                        <h4>Incidencias y observaciones</h4>
                        <div class="grid gap-2">${incidentHtml}</div>
                    </div>
                </div>`;
        }

        async showAttendanceDetail(id) {
            const row = this.todayRows.find((item) => asInt(item.id) === asInt(id));
            if (!row) {
                Swal.fire('Sin turno', 'No se encontró el turno seleccionado.', 'info');
                return;
            }
            const attendance = this.attendanceForSchedule(id);
            Swal.fire({
                title: 'Cargando desglose',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });
            const incidents = await this.incidentsForSchedule(id);
            const person = byId(this.promoters, row.impulsadora_id);
            Swal.fire({
                title: person ? promoterDisplayName(person) : 'Desglose de asistencia',
                html: this.attendanceDetailHtml(row, attendance, incidents),
                width: 620,
                confirmButtonText: 'Cerrar',
                showCloseButton: true
            });
        }

        filters() {
            const options = this.stores
                .filter((store) => (store.activo !== false || asInt(store.id) === this.selectedStoreId) && (!this.session.isStoreUser || asInt(store.id) === this.session.storeId))
                .sort((a, b) => asText(a.nombre_display).localeCompare(asText(b.nombre_display)));
            return `
                <section class="app-filter-stack store-filter-stack">
                    <div class="app-segment-three store-type-segment" aria-label="Filtro de personal">
                        <button class="${this.assignmentFilter === 'all' ? 'active' : ''}" title="Todos: personal interno e impulsadoras" onclick="mobileApp.setAssignmentFilter('all')">Todos</button>
                        <button class="${this.assignmentFilter === 'impulso' ? 'active' : ''}" title="Solo impulsadoras" onclick="mobileApp.setAssignmentFilter('impulso')">Impulsadoras</button>
                        <button class="${this.assignmentFilter === 'interno' ? 'active' : ''}" title="Solo personal interno" onclick="mobileApp.setAssignmentFilter('interno')">Personal interno</button>
                    </div>
                    <select class="w-full p-3 border rounded-xl font-bold" onchange="mobileApp.selectStore(this.value)" ${this.session.isStoreUser ? 'disabled' : ''}>
                        ${options.map((store) => `<option value="${asInt(store.id)}" ${asInt(store.id) === this.selectedStoreId ? 'selected' : ''}>${h(asText(store.nombre_display))}</option>`).join('')}
                    </select>
                    <label class="app-search"><span class="material-icons">search</span><input data-search-input="${this.active === 'internal' ? 'internal-monthly' : 'store-monthly'}" value="${h(this.search)}" oninput="mobileApp.setSearch(this.value, this)" placeholder="Buscar persona, marca, proveedor o tipo"></label>
                    <button class="mini-chip justify-center" onclick="mobileApp.toggleOnlyAssigned()">${this.onlyAssigned ? 'Solo asignadas' : 'Mostrar vacías'}</button>
                </section>`;
        }

        rowKind(row) {
            return asText(row?._kind, 'impulso');
        }

        isInternalRow(row) {
            return this.rowKind(row) === 'interno';
        }

        rowPersonKey(row) {
            if (this.isInternalRow(row)) return `interno:${asInt(row.personal_id)}`;
            return `impulso:${promoterCanonicalKey(byId(this.promoters, row.impulsadora_id) || { id: row.impulsadora_id })}`;
        }

        storeCountLabel() {
            if (this.assignmentFilter === 'impulso') return 'turnos';
            if (this.assignmentFilter === 'interno') return 'internos';
            return 'registros';
        }

        storeDaySubtitle(count) {
            if (this.assignmentFilter === 'impulso') return `${count} persona${count === 1 ? '' : 's'} asignada${count === 1 ? '' : 's'}`;
            if (this.assignmentFilter === 'interno') return `${count} registro${count === 1 ? '' : 's'} interno${count === 1 ? '' : 's'}`;
            return `${count} registro${count === 1 ? '' : 's'} visible${count === 1 ? '' : 's'}`;
        }

        storeEmptyTitle() {
            if (this.assignmentFilter === 'impulso') return 'Sin impulsadoras visibles';
            if (this.assignmentFilter === 'interno') return 'Sin personal interno visible';
            return 'Sin registros visibles';
        }

        storeEmptyMessage() {
            if (this.assignmentFilter === 'impulso') return 'No hay impulsadoras desde hoy para este punto.';
            if (this.assignmentFilter === 'interno') return 'No hay personal interno desde hoy para este punto.';
            return 'No hay personal visible desde hoy para este punto.';
        }

        storePrimaryAddHandler() {
            if (this.assignmentFilter === 'interno') return this.canManageInternal() ? 'mobileApp.openInternalAssignmentForDate' : '';
            if (this.assignmentFilter === 'impulso') return this.session.isManager ? 'mobileApp.openPromoterAssignmentForDate' : '';
            if (this.session.isManager) return 'mobileApp.openPromoterAssignmentForDate';
            return this.canManageInternal() ? 'mobileApp.openInternalAssignmentForDate' : '';
        }

        visibleRows() {
            const needle = normalizeSearch(this.search);
            const rowsForStore = [];

            if (this.assignmentFilter === 'all' || this.assignmentFilter === 'impulso') {
                this.monthlyRows
                    .filter((row) => asInt(row.tienda_id) === this.selectedStoreId)
                    .forEach((row) => rowsForStore.push({ ...row, _kind: 'impulso' }));
            }

            if (this.assignmentFilter === 'all' || this.assignmentFilter === 'interno') {
                this.monthlyInternalRows
                    .filter((row) => asInt(row.tienda_id) === this.selectedStoreId)
                    .forEach((row) => rowsForStore.push({ ...row, _kind: 'interno' }));
            }

            return rowsForStore
                .filter((row) => {
                    const haystack = this.isInternalRow(row)
                        ? this.internalSearchText(row)
                        : this.promoterSearchText(row);
                    return haystack && (!needle || normalizeSearch(haystack).includes(needle));
                })
                .sort((a, b) => {
                    const dateCompare = asText(a.fecha).localeCompare(asText(b.fecha));
                    if (dateCompare) return dateCompare;
                    if (this.rowKind(a) !== this.rowKind(b)) return this.isInternalRow(a) ? 1 : -1;
                    if (this.isInternalRow(a)) return asText(a.tipo).localeCompare(asText(b.tipo)) || asText(byId(this.internalStaff, a.personal_id)?.nombre_completo).localeCompare(asText(byId(this.internalStaff, b.personal_id)?.nombre_completo));
                    return asText(byId(this.promoters, a.impulsadora_id)?.Marca).localeCompare(asText(byId(this.promoters, b.impulsadora_id)?.Marca));
                });
        }

        promoterSearchText(row) {
            const person = byId(this.promoters, row.impulsadora_id);
            if (!person) return '';
            const category = byId(this.categories, person?.idCategoria) || byId(this.categories, row.categoria_asignada_id);
            return `${promoterDisplayName(person)} ${asText(person.Marca)} ${asText(person.Proveedor)} ${asText(category?.descripcion)} Impulsadora Impulso`;
        }

        internalSearchText(row) {
            const person = byId(this.internalStaff, row.personal_id);
            if (!person) return '';
            return `${asText(person.nombre_completo)} ${asText(person.idVendedor || person.idvendedor)} ${asText(row.tipo)} Personal Interno`;
        }

        calendarPersonLabel(row) {
            if (this.isInternalRow(row)) return this.internalCalendarLabel(row);
            const person = byId(this.promoters, row.impulsadora_id);
            return `<div class="calendar-label"><strong>${h(asText(person?.Marca, 'Sin marca'))}</strong><span>${h(person ? promoterDisplayName(person) : 'Personal')}</span></div>`;
        }

        calendarCellContent(dayRows) {
            if (dayRows.every((row) => this.isInternalRow(row))) {
                return `<div class="internal-calendar-list">${dayRows.map((row) => this.calendarPersonLabel(row)).join('')}</div>`;
            }
            return `<div>${dayRows.slice(0, 2).map((row) => this.calendarPersonLabel(row)).join('')}${dayRows.length > 2 ? `<div class="text-[8px] font-black text-[#756c65] mt-1">+${dayRows.length - 2} más</div>` : ''}</div>`;
        }

        internalCalendarLabel(row) {
            const person = byId(this.internalStaff, row.personal_id);
            const store = byId(this.stores, row.tienda_id);
            const tone = internalPersonTone(person, row, store);
            return `
                <div class="calendar-label internal-calendar-label" title="${h(asText(person?.nombre_completo, 'Personal'))}" style="--internal-bg:${h(tone.bg)};--internal-border:${h(tone.border)};--internal-avatar:${h(tone.avatar)};--internal-text:${h(tone.text)};--internal-avatar-text:${h(tone.avatarText)}">
                    <span class="internal-calendar-avatar">${h(internalPersonInitials(person))}</span>
                    <span class="internal-calendar-copy">
                        <span>${h(asText(person?.nombre_completo, 'Personal'))}</span>
                    </span>
                </div>`;
        }

        assignmentRow(row) {
            if (this.isInternalRow(row)) return this.internalAssignmentRow(row);
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

        internalAssignmentRow(row) {
            const person = byId(this.internalStaff, row.personal_id);
            const color = internalTypeColor(row.tipo);
            return `
                <button class="agenda-row w-full text-left" onclick="mobileApp.openInternalActions(${asInt(row.id)})">
                    ${storeBadge(byId(this.stores, this.selectedStoreId), 38)}
                    <span class="flex-1 min-w-0"><span class="app-list-title block truncate" style="color:${color}">${h(asText(row.tipo, 'TRABAJO'))}</span><span class="app-list-title block truncate">${h(asText(person?.nombre_completo, 'Personal interno'))}</span></span>
                    ${miniChip('Interno', color)}
                    <span class="material-icons text-slate-400">chevron_right</span>
                </button>`;
        }

        selectStore(value) {
            this.selectedStoreId = asInt(value) || null;
            this.render();
        }

        setAssignmentFilter(value) {
            this.assignmentFilter = ['all', 'impulso', 'interno'].includes(value) ? value : 'all';
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

        async markLunch(id, action) {
            const isReturn = action === 'ingreso';
            try {
                Swal.fire({
                    title: isReturn ? 'Marcando entrada del almuerzo' : 'Marcando salida al almuerzo',
                    allowOutsideClick: false,
                    didOpen: () => Swal.showLoading()
                });
                const { data, error } = await db.functions.invoke('mark-store-lunch', {
                    body: { horarioId: asInt(id), action }
                });
                if (error) throw error;
                if (data?.error) throw new Error(data.error);
                await this.reload();
                const attendance = data?.attendance || {};
                const minutes = this.lunchDuration(attendance);
                Swal.fire({
                    icon: 'success',
                    title: isReturn ? 'Entrada del almuerzo marcada' : 'Salida al almuerzo marcada',
                    text: isReturn && minutes !== null ? `Almuerzo: ${minutes} min` : 'Hora guardada con reloj central.',
                    timer: 1600,
                    showConfirmButton: false
                });
            } catch (error) {
                Swal.fire('Error', error.message || 'No se pudo marcar el almuerzo', 'error');
            }
        }

        async markExit(id) {
            try {
                Swal.fire({
                    title: 'Marcando salida',
                    allowOutsideClick: false,
                    didOpen: () => Swal.showLoading()
                });
                const { data, error } = await db.functions.invoke('mark-store-exit', {
                    body: { horarioId: asInt(id) }
                });
                if (error) throw error;
                if (data?.error) throw new Error(data.error);
                await this.reload();
                const out = timeInGuayaquil(data?.attendance?.salida_en);
                Swal.fire({
                    icon: 'success',
                    title: 'Salida marcada',
                    text: out ? `Hora: ${out}` : 'Hora guardada con reloj central.',
                    timer: 1600,
                    showConfirmButton: false
                });
            } catch (error) {
                Swal.fire('Error', error.message || 'No se pudo marcar la salida', 'error');
            }
        }

        openDaySheet(key) {
            const rowsForDay = this.visibleRows().filter((row) => asText(row.fecha) === key);
            const date = parseDate(key);
            Swal.fire({
                title: prettyDate(date),
                html: `<p class="text-slate-500 mb-3">${h(asText(byId(this.stores, this.selectedStoreId)?.nombre_display, 'Tienda'))}</p>${rowsForDay.length ? rowsForDay.map((row) => this.assignmentRow(row)).join('') : emptyState('person_off', this.storeEmptyTitle(), 'No hay personal visible para esta fecha.')}${this.assignmentButtonsForDay(key)}`,
                showConfirmButton: false,
                showCloseButton: true
            });
        }

        openAssignmentForDate(key) {
            if (this.assignmentFilter === 'interno') {
                this.openInternalAssignmentForDate(key);
                return;
            }
            this.openPromoterAssignmentForDate(key);
        }

        openPromoterAssignmentForDate(key) {
            this.showPromoterForm(null, parseDate(key) || this.selected, this.selectedStoreId);
        }

        openInternalAssignmentForDate(key) {
            this.showInternalForm(null, parseDate(key) || this.defaultAssignmentDate(), this.selectedStoreId);
        }

        assignmentButtonsForDay(key) {
            const buttons = [];
            if (this.assignmentFilter !== 'interno' && this.session.isManager) {
                buttons.push(`<button class="bottom-action mt-3" onclick="Swal.close(); mobileApp.openPromoterAssignmentForDate('${key}')">Asignar impulso</button>`);
            }
            if (this.assignmentFilter !== 'impulso' && this.canManageInternal()) {
                buttons.push(`<button class="bottom-action teal mt-3" onclick="Swal.close(); mobileApp.openInternalAssignmentForDate('${key}')">Nueva asignación interna</button>`);
            }
            return buttons.join('');
        }

        openActions(id) {
            const row = this.monthlyRows.find((item) => asInt(item.id) === id);
            if (!row) return;
            const person = byId(this.promoters, row.impulsadora_id);
            const store = byId(this.stores, row.tienda_id);
            const canReport = this.canReportIncidentForRow(row);
            Swal.fire({
                title: person ? promoterDisplayName(person) : 'Turno',
                html: `
                    <p class="text-slate-500 mb-4 text-sm">${h(asText(store?.nombre_display, 'Tienda'))} - ${h(asText(row.fecha))}</p>
                    <div class="grid gap-2">
                        ${this.session.isManager ? `<button class="bottom-action full" onclick="Swal.close(); mobileApp.showPromoterFormById(${asInt(row.id)})">Modificar asignación</button><button class="bottom-action ink full" onclick="Swal.close(); mobileApp.deletePromoter(${asInt(row.id)})">Eliminar</button>` : ''}
                        ${canReport ? `<button class="bottom-action teal full" onclick="Swal.close(); mobileApp.reportIncident(${asInt(row.id)})">Reportar incidencia</button>` : '<p class="app-list-subtitle text-center">Las incidencias futuras se habilitan el día del turno.</p>'}
                    </div>`,
                showConfirmButton: false,
                showCloseButton: true
            });
        }

        canReportIncidentForRow(row) {
            if (this.session.isManager) return true;
            return asText(row?.fecha) <= todayKeyInGuayaquil();
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
            const row = this.monthlyRows.find((item) => asInt(item.id) === asInt(id));
            if (row && !this.canReportIncidentForRow(row)) {
                Swal.fire('Turno futuro', 'Solo puedes reportar incidencias de hoy o de fechas anteriores.', 'warning');
                return Promise.resolve(false);
            }
            return PlannerView.prototype.reportIncident.call(this, id);
        }

        canManageInternal() {
            if (this.session.isManager) return true;
            return this.session.isStoreUser && asInt(this.selectedStoreId) === asInt(this.session.storeId);
        }

        defaultAssignmentDate() {
            const today = new Date();
            if (today.getFullYear() === this.selected.getFullYear() && today.getMonth() === this.selected.getMonth()) {
                return new Date(today.getFullYear(), today.getMonth(), today.getDate());
            }
            return this.selected;
        }

        openInternalActions(id) {
            const row = this.monthlyInternalRows.find((item) => asInt(item.id) === asInt(id));
            if (!row || asInt(row.tienda_id) !== asInt(this.selectedStoreId)) return;
            const person = byId(this.internalStaff, row.personal_id);
            const store = byId(this.stores, row.tienda_id);
            Swal.fire({
                title: asText(person?.nombre_completo, 'Personal interno'),
                html: `
                    <p class="text-slate-500 mb-4 text-sm">${h(asText(store?.nombre_display, 'Bodega/Tienda'))} - ${h(asText(row.fecha))}</p>
                    <div class="grid gap-2">
                        ${this.canManageInternal() ? `<button class="bottom-action full" onclick="Swal.close(); mobileApp.editInternalAssignment(${asInt(row.id)})">Modificar asignación</button><button class="bottom-action ink full" onclick="Swal.close(); mobileApp.deleteInternalAssignment(${asInt(row.id)})">Eliminar asignación</button>` : `<p class="font-bold">${h(asText(row.tipo, 'TRABAJO'))}</p>`}
                    </div>`,
                showConfirmButton: false,
                showCloseButton: true
            });
        }

        editInternalAssignment(id) {
            const row = this.monthlyInternalRows.find((item) => asInt(item.id) === asInt(id));
            if (!row || !this.canManageInternal() || asInt(row.tienda_id) !== asInt(this.selectedStoreId)) return;
            this.showInternalForm(row, parseDate(row.fecha), this.selectedStoreId);
        }

        async deleteInternalAssignment(id) {
            const row = this.monthlyInternalRows.find((item) => asInt(item.id) === asInt(id));
            if (!row || !this.canManageInternal() || asInt(row.tienda_id) !== asInt(this.selectedStoreId)) return;
            const ok = await Swal.fire({
                title: 'Eliminar asignación',
                text: 'Se eliminará este registro del horario interno.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Eliminar',
                cancelButtonText: 'Cancelar'
            });
            if (!ok.isConfirmed) return;
            try {
                await rows(db.from(tables.internalSchedule).delete().eq('id', asInt(id)).select());
                await this.reload();
                Swal.fire({ icon: 'success', title: 'Asignación eliminada', timer: 1300, showConfirmButton: false });
            } catch (error) {
                Swal.fire('Error', error.message || 'No se pudo eliminar la asignación', 'error');
            }
        }

        showInternalForm(existing, date, forcedStoreId, forcedPersonId = null) {
            this.internalRows = this.monthlyInternalRows;
            return PlannerView.prototype.showInternalForm.call(this, existing, date, forcedStoreId, forcedPersonId);
        }
    }

    class InternalMonthView extends StoreMonthView {
        constructor() {
            super();
            this.active = 'internal';
            this.staff = [];
            this.personMode = false;
            this.selectedInternalPersonId = null;
            this.showCrossStoreInternal = true;
        }

        async load() {
            await this.loadBase();
            this.staff = this.internalStaff;
            this.monthlyRows = await this.monthlyInternalAssignments(this.selected, { scopeToStore: false });
            this.monthlyInternalRows = this.monthlyRows;
            if (this.session.isStoreUser) this.selectedStoreId = this.session.storeId;
            if (!this.selectedStoreId && this.stores.length) this.selectedStoreId = asInt(this.stores[0].id);
        }

        render() {
            const store = byId(this.stores, this.selectedStoreId);
            const modeSwitch = `
                <span class="topbar-mode-switch" role="group" aria-label="Modo de vista interna">
                    ${iconButton('table_chart', 'mobileApp.showInternalCalendarMode()', 'Calendario mensual', !this.personMode, '', true)}
                    ${iconButton('badge', 'mobileApp.showInternalPersonMode()', 'Por vendedor', this.personMode, '', true)}
                </span>`;
            const actions = [
                this.canManageInternal() && this.selectedStoreId ? iconButton('add_circle', 'mobileApp.openAssignmentForDate()', 'Nueva asignación', false, 'primary') : '',
                this.canManageInternal() && this.selectedStoreId && !this.personMode ? iconButton('event_repeat', 'mobileApp.openMonthlyInternalFill()', 'Llenar mes') : '',
                modeSwitch,
                iconButton('refresh', 'mobileApp.reload()', 'Actualizar')
            ].join('');
            const selectedPerson = this.selectedInternalPerson();
            let subtitle = this.selectedStoreId ? `${asText(store?.nombre_display, 'Bodega/Tienda')} - ${monthLabel(this.selected)}` : 'Selecciona bodega o tienda';
            if (this.personMode) {
                subtitle = selectedPerson
                    ? `${this.internalPersonStoreSummary(selectedPerson)} - ${asText(selectedPerson.nombre_completo, 'Personal')}`
                    : `Todas las tiendas - ${monthLabel(this.selected)}`;
            }
            shell('internal', this.personMode ? 'Interno por vendedor' : 'Interno', subtitle, actions, this.personMode ? this.personContent() : this.content());
        }

        canManageInternal() {
            if (this.session.isManager) return true;
            return this.session.isStoreUser && asInt(this.selectedStoreId) === asInt(this.session.storeId);
        }

        filters() {
            const options = this.stores
                .filter((store) => (store.activo !== false || asInt(store.id) === this.selectedStoreId) && (!this.session.isStoreUser || asInt(store.id) === this.session.storeId))
                .sort((a, b) => asText(a.nombre_display).localeCompare(asText(b.nombre_display)));
            return `
                <section class="app-filter-stack internal-filter-stack">
                    <select class="w-full p-3 border rounded-xl font-bold" onchange="mobileApp.selectStore(this.value)" ${this.session.isStoreUser ? 'disabled' : ''}>
                        ${options.map((store) => `<option value="${asInt(store.id)}" ${asInt(store.id) === this.selectedStoreId ? 'selected' : ''}>${h(asText(store.nombre_display))}</option>`).join('')}
                    </select>
                    <label class="app-search"><span class="material-icons">search</span><input data-search-input="internal-monthly" value="${h(this.search)}" oninput="mobileApp.setSearch(this.value, this)" placeholder="Buscar personal, tienda o tipo"></label>
                    <label class="mini-chip justify-center internal-cross-store-toggle" title="Mostrar el horario completo de las personas que están en el local filtrado">
                        <input type="checkbox" ${this.showCrossStoreInternal ? 'checked' : ''} onchange="mobileApp.toggleInternalCrossStore()">
                        Todos los puntos
                    </label>
                    <button class="mini-chip justify-center" onclick="mobileApp.toggleOnlyAssigned()">${this.onlyAssigned ? 'Solo asignadas' : 'Mostrar vacías'}</button>
                </section>`;
        }

        visibleRows() {
            const needle = normalizeSearch(this.search);
            const sourceRows = this.internalRowsForCurrentScope(this.showCrossStoreInternal);
            return sourceRows
                .filter((row) => {
                    const person = byId(this.staff, row.personal_id);
                    const store = byId(this.stores, row.tienda_id);
                    if (!person) return false;
                    if (!needle) return true;
                    return normalizeSearch(`${asText(person.nombre_completo)} ${asText(person.idVendedor || person.idvendedor)} ${asText(row.tipo)} ${asText(store?.nombre_display)} ${asText(store?.alias_tienda)}`).includes(needle);
                })
                .sort((a, b) => {
                    const dateCompare = asText(a.fecha).localeCompare(asText(b.fecha));
                    if (dateCompare) return dateCompare;
                    const storeCompare = asText(byId(this.stores, a.tienda_id)?.nombre_display).localeCompare(asText(byId(this.stores, b.tienda_id)?.nombre_display));
                    if (storeCompare) return storeCompare;
                    return asText(a.tipo).localeCompare(asText(b.tipo)) || asText(byId(this.staff, a.personal_id)?.nombre_completo).localeCompare(asText(byId(this.staff, b.personal_id)?.nombre_completo));
                });
        }

        internalBaseStoreRows() {
            return this.monthlyRows.filter((row) => asInt(row.tienda_id) === asInt(this.selectedStoreId));
        }

        internalVisiblePersonIds() {
            return new Set(this.internalBaseStoreRows().map((row) => asInt(row.personal_id)).filter(Boolean));
        }

        internalRowsForCurrentScope(includeOtherStores = true) {
            const storeRows = this.internalBaseStoreRows();
            if (!includeOtherStores) return storeRows;
            const visiblePersonIds = this.internalVisiblePersonIds();
            return this.monthlyRows.filter((row) => visiblePersonIds.has(asInt(row.personal_id)));
        }

        toggleInternalCrossStore() {
            this.showCrossStoreInternal = !this.showCrossStoreInternal;
            this.render();
        }

        personModeRows() {
            const rows = this.session.isStoreUser
                ? this.internalRowsForCurrentScope(true)
                : this.monthlyRows;
            return rows.slice()
                .sort((a, b) => asText(a.fecha).localeCompare(asText(b.fecha)) || asText(byId(this.stores, a.tienda_id)?.nombre_display).localeCompare(asText(byId(this.stores, b.tienda_id)?.nombre_display)));
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
                    subtitle: this.showCrossStoreInternal
                        ? `${asText(byId(this.stores, this.selectedStoreId)?.nombre_display, 'Bodega/Tienda')} + otros puntos`
                        : asText(byId(this.stores, this.selectedStoreId)?.nombre_display, 'Bodega/Tienda'),
                    countLabel: 'registros',
                    personId: (row) => asInt(row.personal_id),
                    peopleLabel: (people, stores) => this.showCrossStoreInternal ? `${people} personas / ${stores} puntos` : `${people} personas`,
                    dayHandler: 'mobileApp.openDaySheet',
                    cellContent: (dayRows) => `<div class="internal-calendar-grid">${dayRows.map((row) => this.calendarPersonLabel(row)).join('')}</div>`
                }) + agendaList({
                    selected: this.selected,
                    rows: rowsForStore,
                    onlyAssigned: this.onlyAssigned,
                    emptyIcon: 'person_off',
                    emptyTitle: 'Sin registros visibles',
                    emptyMessage: 'No hay días desde hoy para esta bodega.',
                    daySubtitle: (count) => `${count} registro${count === 1 ? '' : 's'} interno${count === 1 ? '' : 's'}`,
                    addHandler: this.canManageInternal() ? 'mobileApp.openAssignmentForDate' : '',
                    row: (row) => this.assignmentRow(row)
                }) : emptyState('warehouse', 'Elige una bodega', 'Verás el calendario mensual del personal interno.')}
            `;
        }

        showInternalPersonMode() {
            this.personMode = true;
            this.render();
        }

        showInternalCalendarMode() {
            this.personMode = false;
            this.render();
        }

        personFilters() {
            return `
                <section class="app-filter-stack">
                    <label class="app-search"><span class="material-icons">search</span><input data-search-input="internal-monthly" value="${h(this.search)}" oninput="mobileApp.setSearch(this.value, this)" placeholder="Buscar personal, tienda o tipo"></label>
                    <button class="mini-chip justify-center" onclick="mobileApp.toggleOnlyAssigned()">${this.onlyAssigned ? 'Solo asignadas' : 'Mostrar vacías'}</button>
                </section>`;
        }

        internalPeopleRows() {
            const allRows = this.personModeRows();
            const rowPersonIds = new Set(allRows.map((row) => asInt(row.personal_id)));
            const selectedId = asInt(this.selectedInternalPersonId);
            const needle = normalizeSearch(this.search);
            return this.staff
                .filter((person) => this.session.isStoreUser ? rowPersonIds.has(asInt(person.id)) : (activeInternal(person) || rowPersonIds.has(asInt(person.id))))
                .filter((person) => {
                    const personRows = allRows.filter((row) => asInt(row.personal_id) === asInt(person.id));
                    if (asInt(person.id) === selectedId) return true;
                    if (this.onlyAssigned && !personRows.length) return false;
                    if (!needle) return true;
                    const storeNames = personRows.map((row) => asText(byId(this.stores, row.tienda_id)?.nombre_display)).join(' ');
                    return `${normalizeSearch(person.nombre_completo)} ${normalizeSearch(person.idVendedor || person.idvendedor)} ${normalizeSearch(person.PIN || person.pin)} ${normalizeSearch(storeNames)} ${normalizeSearch(personRows.map((row) => row.tipo).join(' '))}`.includes(needle);
                })
                .sort((a, b) => {
                    const aSelected = asInt(a.id) === selectedId;
                    const bSelected = asInt(b.id) === selectedId;
                    if (aSelected !== bSelected) return aSelected ? -1 : 1;
                    const countA = allRows.filter((row) => asInt(row.personal_id) === asInt(a.id)).length;
                    const countB = allRows.filter((row) => asInt(row.personal_id) === asInt(b.id)).length;
                    if (countA !== countB) return countB - countA;
                    return asText(a.nombre_completo).localeCompare(asText(b.nombre_completo));
                });
        }

        personContent() {
            const people = this.internalPeopleRows();
            const person = this.selectedInternalPerson();
            return `
                ${monthControls(this.selected, 'mobileApp.changeMonth(-1)', 'mobileApp.changeMonth(1)')}
                ${this.personFilters()}
                ${this.internalPersonSelector(people)}
                ${person ? this.internalPersonSchedule(person) : (people.length ? emptyState('badge', 'Elige personal interno', 'Selecciona una persona para ver su horario mensual.') : '')}
            `;
        }

        internalPersonSelector(people) {
            if (!people.length) {
                return emptyState('person_search', 'Sin personal visible', 'Ajusta la búsqueda o muestra también personas sin registros.');
            }
            return `
                <div class="section-title-row"><h2>Personal interno</h2>${this.selectedInternalPersonId ? `<button class="mini-chip" onclick="mobileApp.clearInternalPersonSelection()">Limpiar</button>` : ''}</div>
                ${scrollFrame('vendor-scroll', people.map((person) => this.internalPersonCard(person)).join(''), 'personal interno')}`;
        }

        internalVendorMeta(person) {
            const code = asText(person?.idVendedor || person?.idvendedor, '-');
            const pin = asText(person?.PIN || person?.pin, '-');
            return `Codigo ${code} - PIN ${pin}`;
        }

        vendorStat(label, value, icon, color) {
            return `<article class="vendor-stat"><span class="material-icons" style="color:${h(color)}">${h(icon)}</span><strong>${h(value)}</strong><small>${h(label)}</small></article>`;
        }

        internalPersonCard(person) {
            const selected = asInt(person.id) === asInt(this.selectedInternalPersonId);
            const rowsForPerson = this.internalPersonScheduleRows(person);
            const storesForPerson = this.internalPersonStores(person);
            const store = storesForPerson[0] || byId(this.stores, this.selectedStoreId);
            const tone = internalPersonTone(person, rowsForPerson[0], store);
            return `
                <button class="vendor-card app-card ${selected ? 'active' : ''}" onclick="mobileApp.selectInternalPerson(${asInt(person.id)})">
                    <span class="vendor-avatar" style="background:${h(tone.avatar)};color:${h(tone.avatarText)}">${h(internalPersonInitials(person))}</span>
                    <span class="vendor-card-copy">
                        <strong>${h(asText(person.nombre_completo, 'Personal'))}</strong>
                        <small>${h(this.internalVendorMeta(person))}</small>
                    </span>
                    <span class="vendor-card-stats">
                        ${miniChip(`${rowsForPerson.length} días`, '#0E9F8F')}
                        ${storesForPerson.length ? miniChip(storesForPerson.length === 1 ? asText(storesForPerson[0]?.alias_tienda, '1 tienda') : `${storesForPerson.length} tiendas`, colorFromStore(storesForPerson[0])) : ''}
                    </span>
                    ${selected ? '<span class="material-icons vendor-card-check">check_circle</span>' : ''}
                </button>`;
        }

        selectInternalPerson(id) {
            this.selectedInternalPersonId = asInt(id) || null;
            this.render();
        }

        clearInternalPersonSelection() {
            this.selectedInternalPersonId = null;
            this.render();
        }

        selectedInternalPerson() {
            const selectedId = asInt(this.selectedInternalPersonId);
            if (!selectedId) return null;
            return byId(this.staff, selectedId) || null;
        }

        internalPersonScheduleRows(person) {
            if (!person) return [];
            return this.personModeRows().filter((row) => asInt(row.personal_id) === asInt(person.id));
        }

        internalPersonStores(person) {
            const seen = new Set();
            return this.internalPersonScheduleRows(person)
                .map((row) => byId(this.stores, row.tienda_id))
                .filter((store) => {
                    const id = asInt(store?.id);
                    if (!id || seen.has(id)) return false;
                    seen.add(id);
                    return true;
                });
        }

        internalPersonStoreSummary(person) {
            const stores = this.internalPersonStores(person);
            if (!stores.length) return 'Sin tiendas';
            if (stores.length === 1) return asText(stores[0]?.nombre_display, 'Tienda');
            return `${stores.length} tiendas`;
        }

        internalPersonCalendarBadge(stores) {
            if (stores.length === 1) return storeBadge(stores[0], 48);
            return `<span class="store-badge-ui" style="width:48px;height:48px;background:#111827;color:#fff;font-size:18px"><span class="material-icons">storefront</span></span>`;
        }

        internalPersonSchedule(person) {
            const rowsForPerson = this.internalPersonScheduleRows(person);
            const storesForPerson = this.internalPersonStores(person);
            const store = storesForPerson[0] || byId(this.stores, this.selectedStoreId);
            const tone = internalPersonTone(person, rowsForPerson[0], store);
            const storeCount = storesForPerson.length;
            return `
                <section class="vendor-schedule-panel">
                    <div class="vendor-schedule-head app-card">
                        <span class="vendor-avatar large" style="background:${h(tone.avatar)};color:${h(tone.avatarText)}">${h(internalPersonInitials(person))}</span>
                        <span class="flex-1 min-w-0">
                            <strong>${h(asText(person.nombre_completo, 'Personal'))}</strong>
                            <small>${h(this.internalVendorMeta(person))}</small>
                        </span>
                        ${this.canManageInternal() ? `
                            <span class="vendor-schedule-actions">
                                <button class="planner-icon-btn" title="Asignar día" onclick="mobileApp.showInternalForm(null, mobileApp.defaultAssignmentDate(), mobileApp.selectedStoreId, ${asInt(person.id)})"><span class="material-icons">edit_calendar</span></button>
                            </span>` : ''}
                    </div>
                    <div class="vendor-stat-row">
                        ${this.vendorStat('Dias asignados', rowsForPerson.length, 'event_available', '#0E9F8F')}
                        ${this.vendorStat('Tiendas', storeCount || '-', 'storefront', '#111827')}
                        ${this.vendorStat('Mes', monthShort[this.selected.getMonth()], 'calendar_month', '#111827')}
                        ${this.vendorStat('PIN', asText(person.PIN || person.pin, '-'), 'pin', '#111827')}
                    </div>
                    ${calendarBoard({
                        selected: this.selected,
                        rows: rowsForPerson,
                        badge: this.internalPersonCalendarBadge(storesForPerson),
                        subtitle: `${this.internalPersonStoreSummary(person)} - ${asText(person.nombre_completo, 'Personal')}`,
                        countLabel: 'días',
                        personId: () => asInt(person.id),
                        peopleLabel: () => `${storeCount || 0} tienda${storeCount === 1 ? '' : 's'}`,
                        dayHandler: 'mobileApp.openInternalPersonDay',
                        cellContent: (dayRows) => `<div>${dayRows.slice(0, 3).map((row) => this.internalPersonCalendarLabel(row)).join('')}${dayRows.length > 3 ? `<div class="text-[8px] font-black text-[#756c65] mt-1">+${dayRows.length - 3} más</div>` : ''}</div>`
                    })}
                </section>`;
        }

        internalPersonCalendarLabel(row) {
            const store = byId(this.stores, row.tienda_id || this.selectedStoreId);
            const color = isInternalFreeType(row.tipo) ? '#111827' : colorFromStore(store);
            const foreground = isLightColor(color) ? '#111827' : '#ffffff';
            return `<span class="vendor-calendar-label" title="${h(asText(store?.nombre_display, 'Tienda'))} - ${h(asText(row.tipo, 'TRABAJO'))}" style="background:${h(color)};color:${foreground}">${h(asText(store?.alias_tienda, 'T'))}</span>`;
        }

        openInternalPersonDay(key) {
            const person = this.selectedInternalPerson();
            if (!person) return;
            const rowsForDay = this.internalPersonScheduleRows(person).filter((row) => asText(row.fecha) === key);
            if (rowsForDay.length) {
                this.openActions(asInt(rowsForDay[0].id));
                return;
            }
            if (this.canManageInternal()) {
                this.showInternalForm(null, parseDate(key) || this.defaultAssignmentDate(), this.selectedStoreId, asInt(person.id));
            }
        }

        calendarPersonLabel(row) {
            const person = byId(this.staff, row.personal_id);
            const store = byId(this.stores, row.tienda_id || this.selectedStoreId);
            const tone = internalPersonTone(person, row, store);
            return `
                <div class="calendar-label internal-calendar-label initials-only" title="${h(asText(person?.nombre_completo, 'Personal'))} - ${h(asText(store?.nombre_display, 'Tienda'))}" style="--internal-bg:${h(tone.bg)};--internal-border:${h(tone.border)};--internal-avatar:${h(tone.avatar)};--internal-text:${h(tone.text)};--internal-avatar-text:${h(tone.avatarText)}">
                    <span class="internal-calendar-avatar">${h(internalPersonInitials(person))}</span>
                </div>`;
        }

        assignmentRow(row) {
            const person = byId(this.staff, row.personal_id);
            const store = byId(this.stores, row.tienda_id || this.selectedStoreId);
            const color = internalTypeColor(row.tipo);
            return `
                <button class="agenda-row w-full text-left" onclick="mobileApp.openActions(${asInt(row.id)})">
                    ${storeBadge(store, 38)}
                    <span class="flex-1 min-w-0"><span class="app-list-title block truncate" style="color:${color}">${h(asText(row.tipo, 'TRABAJO'))}</span><span class="app-list-title block truncate">${h(asText(person?.nombre_completo, 'Personal'))}</span><span class="app-list-subtitle block truncate">${h(asText(store?.nombre_display, 'Bodega/Tienda'))}</span></span>
                    <span class="material-icons text-slate-400">chevron_right</span>
                </button>`;
        }

        openAssignmentForDate(key) {
            this.showInternalForm(null, parseDate(key) || this.defaultAssignmentDate(), this.selectedStoreId);
        }

        openDaySheet(key) {
            const rowsForDay = this.visibleRows().filter((row) => asText(row.fecha) === key);
            const date = parseDate(key);
            Swal.fire({
                title: prettyDate(date),
                html: `<p class="text-slate-500 mb-3">${h(this.showCrossStoreInternal ? `${asText(byId(this.stores, this.selectedStoreId)?.nombre_display, 'Bodega/Tienda')} + otros puntos` : asText(byId(this.stores, this.selectedStoreId)?.nombre_display, 'Bodega/Tienda'))}</p>${rowsForDay.length ? rowsForDay.map((row) => this.assignmentRow(row)).join('') : emptyState('person_off', 'Sin registros', 'No hay personal interno en esta fecha.')}${this.canManageInternal() ? `<button class="bottom-action mt-3" onclick="Swal.close(); mobileApp.openAssignmentForDate('${key}')">Nueva asignación interna</button>` : ''}`,
                showConfirmButton: false,
                showCloseButton: true
            });
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
            if (!row) return;
            const isVisibleCrossStoreRow = this.showCrossStoreInternal && this.visibleRows().some((item) => asInt(item.id) === asInt(row.id));
            if (!this.personMode && asInt(row.tienda_id) !== asInt(this.selectedStoreId) && !isVisibleCrossStoreRow) return;
            const person = byId(this.staff, row.personal_id);
            const store = byId(this.stores, row.tienda_id);
            const canEditRow = this.canManageInternalRow(row);
            Swal.fire({
                title: asText(person?.nombre_completo, 'Personal interno'),
                html: `
                    <p class="text-slate-500 mb-4 text-sm">${h(asText(store?.nombre_display, 'Bodega/Tienda'))} - ${h(asText(row.fecha))}</p>
                    ${canEditRow ? `<div class="grid gap-2">
                        <button class="bottom-action full" onclick="Swal.close(); mobileApp.editInternalAssignment(${asInt(row.id)})">Modificar asignación</button>
                        <button class="bottom-action ink full" onclick="Swal.close(); mobileApp.deleteInternalAssignment(${asInt(row.id)})">Eliminar asignación</button>
                    </div>` : `<p class="font-bold">${h(asText(row.tipo, 'TRABAJO'))}</p>`}`,
                showConfirmButton: false,
                showCloseButton: true
            });
        }

        canManageInternalRow(row) {
            if (this.session.isManager) return true;
            return this.session.isStoreUser && asInt(row?.tienda_id) === asInt(this.session.storeId);
        }

        editInternalAssignment(id) {
            const row = this.monthlyRows.find((item) => asInt(item.id) === asInt(id));
            if (!row || !this.canManageInternalRow(row)) return;
            this.showInternalForm(row, parseDate(row.fecha), row.tienda_id || this.selectedStoreId);
        }

        async deleteInternalAssignment(id) {
            const row = this.monthlyRows.find((item) => asInt(item.id) === asInt(id));
            if (!row || !this.canManageInternalRow(row)) return;
            const ok = await Swal.fire({
                title: 'Eliminar asignación',
                text: 'Se eliminará este registro del horario interno.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Eliminar',
                cancelButtonText: 'Cancelar'
            });
            if (!ok.isConfirmed) return;
            try {
                await rows(db.from(tables.internalSchedule).delete().eq('id', asInt(id)).select());
                await this.reload();
                Swal.fire({ icon: 'success', title: 'Asignación eliminada', timer: 1300, showConfirmButton: false });
            } catch (error) {
                Swal.fire('Error', error.message || 'No se pudo eliminar la asignación', 'error');
            }
        }

        async openMonthlyInternalFill() {
            if (!this.canManageInternal() || !this.selectedStoreId) return;
            const activeStaff = this.staff
                .filter((person) => activeInternal(person))
                .sort((a, b) => asText(a.nombre_completo).localeCompare(asText(b.nombre_completo)));
            const currentStore = byId(this.stores, this.selectedStoreId);
            const { value } = await Swal.fire({
                title: 'Llenar mes',
                html: `
                    <div class="grid gap-3 text-left">
                        <p class="text-sm font-bold text-slate-500">Se crearán registros de ${h(monthLabel(this.selected))} para ${h(asText(currentStore?.nombre_display, 'esta tienda'))}. Los días ya asignados se omiten.</p>
                        <label class="text-xs font-bold text-slate-500">Personal<select id="mw-fill-person" class="w-full p-3 border rounded-xl mt-1"><option value="">Seleccionar</option>${activeStaff.map((person) => `<option value="${asInt(person.id)}">${h(asText(person.nombre_completo))}</option>`).join('')}</select></label>
                        <label class="text-xs font-bold text-slate-500">Tipo<select id="mw-fill-type" class="w-full p-3 border rounded-xl mt-1">${['TRABAJO', 'VACACIONES', 'PERMISO', 'LICENCIA'].map((type) => `<option value="${type}" ${type === 'TRABAJO' ? 'selected' : ''}>${type}</option>`).join('')}</select></label>
                    </div>`,
                showCancelButton: true,
                confirmButtonText: 'Llenar mes',
                preConfirm: () => ({
                    personal_id: asInt(document.getElementById('mw-fill-person').value),
                    tipo: document.getElementById('mw-fill-type').value
                })
            });
            if (!value) return;
            if (!value.personal_id) {
                Swal.fire('Faltan datos', 'Selecciona el personal interno.', 'warning');
                return;
            }

            const first = dateKey(monthStart(this.selected));
            const last = dateKey(monthEnd(this.selected));
            try {
                const existingRows = await rows(db.from(tables.internalSchedule)
                    .select('id,fecha,personal_id,tienda_id')
                    .eq('personal_id', value.personal_id)
                    .gte('fecha', first)
                    .lte('fecha', last));
                const assignedDates = new Set(existingRows.map((row) => asText(row.fecha)));
                const payload = [];
                const daysInMonth = monthEnd(this.selected).getDate();
                for (let day = 1; day <= daysInMonth; day += 1) {
                    const key = dateKey(new Date(this.selected.getFullYear(), this.selected.getMonth(), day));
                    if (assignedDates.has(key)) continue;
                    payload.push({
                        fecha: key,
                        personal_id: value.personal_id,
                        tienda_id: asInt(this.selectedStoreId),
                        tipo: value.tipo
                    });
                }
                if (!payload.length) {
                    Swal.fire('Mes completo', 'Ese personal ya tiene registros para todos los días del mes.', 'info');
                    return;
                }
                await rows(db.from(tables.internalSchedule).insert(payload).select());
                await this.reload();
                Swal.fire({
                    icon: 'success',
                    title: 'Mes llenado',
                    text: `${payload.length} días agregados. ${assignedDates.size ? `${assignedDates.size} días ya estaban asignados.` : ''}`,
                    timer: 1800,
                    showConfirmButton: false
                });
            } catch (error) {
                Swal.fire('Error', window.StaffPlanner.duplicateMessage(error), 'error');
            }
        }

        showInternalForm(existing, date, forcedStoreId, forcedPersonId = null) {
            this.internalRows = this.monthlyRows;
            this.internalStaff = this.staff;
            return PlannerView.prototype.showInternalForm.call(this, existing, date, forcedStoreId, forcedPersonId);
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
                if (isPrematureAutomaticAbsence(item.raw, item.schedule)) return false;
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
            const absences = filtered.filter((item) => this.isAbsenceSubject(item.raw.asunto)).length;
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
                if (isPrematureAutomaticAbsence(incident, schedule)) return '';
                const person = byId(this.promoters, schedule?.impulsadora_id);
                return person ? promoterDisplayName(person) : 'Desconocido';
            }).filter(Boolean))].sort();
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

        isAbsenceSubject(subject) {
            const upper = asText(subject).toUpperCase();
            return upper.includes('FALTA') || upper.includes('INJUSTIFICADA');
        }

        canRemoveAbsence(item) {
            return this.session.isAdmin && this.isAbsenceSubject(item?.raw?.asunto);
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
            const removeAction = this.canRemoveAbsence(item)
                ? `<button class="bottom-action ink full mt-3" onclick="Swal.close(); mobileApp.removeAbsence(${asInt(item.raw.id)})"><span class="material-icons text-base">delete_forever</span> Remover falta</button>`
                : '';
            Swal.fire({
                title: item.personName,
                html: `
                    <div class="grid gap-2 text-left">
                        <div><strong>Tienda</strong><p>${h(item.storeName)}</p></div>
                        <div><strong>Turno</strong><p>${h(item.shiftDate)}</p></div>
                        <div><strong>Asunto</strong><p>${h(asText(item.raw.asunto))}</p></div>
                        <div><strong>Observación</strong><p>${h(asText(item.raw.observacion, '-'))}</p></div>
                    </div>
                    ${removeAction}`,
                showCloseButton: true,
                showConfirmButton: false
            });
        }

        async removeAbsence(incidentId) {
            const item = this.enriched().find((entry) => asInt(entry.raw.id) === asInt(incidentId));
            if (!item || !this.canRemoveAbsence(item)) {
                Swal.fire('Sin permiso', 'Solo el Administrador puede remover faltas.', 'warning');
                return;
            }

            const { value: reason } = await Swal.fire({
                title: 'Remover falta',
                html: `
                    <div class="text-left text-sm text-slate-600">
                        <p><strong>${h(item.personName)}</strong></p>
                        <p>${h(item.storeName)} - Turno ${h(item.shiftDate)}</p>
                        <p class="mt-2">Escribe el motivo por el cual esta falta se remueve del reporte.</p>
                    </div>`,
                input: 'textarea',
                inputPlaceholder: 'Ej. La impulsadora sí asistió al punto y se verificó con el administrador.',
                inputAttributes: {
                    'aria-label': 'Motivo de remoción'
                },
                showCancelButton: true,
                confirmButtonText: 'Remover falta',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#DC2626',
                preConfirm: (value) => {
                    const text = asText(value).trim();
                    if (text.length < 5) {
                        Swal.showValidationMessage('El motivo es obligatorio.');
                        return false;
                    }
                    return text;
                }
            });

            if (!reason) return;

            try {
                Swal.fire({
                    title: 'Removiendo falta',
                    allowOutsideClick: false,
                    didOpen: () => Swal.showLoading()
                });
                const { data, error } = await db.functions.invoke('remove-absence', {
                    body: {
                        incidentId: asInt(incidentId),
                        reason
                    }
                });
                if (data?.error) throw new Error(data.error);
                if (error) throw error;
                await this.reload();
                Swal.fire({ icon: 'success', title: 'Falta removida', timer: 1500, showConfirmButton: false });
            } catch (error) {
                Swal.fire('Error', error.message || 'No se pudo remover la falta', 'error');
            }
        }
    }

    class MessagesView extends BaseView {
        constructor() {
            super('messages');
            this.messages = [];
            this.destinations = [];
            this.messageStates = [];
            this.stores = [];
            this.mailboxFilter = 'pending';
            this.search = '';
        }

        async load() {
            const userId = asInt(sessionStorage.getItem('staffPlannerUserId'));
            if (this.session.isManager) {
                const [stores, messages, destinations, states] = await Promise.all([
                    rows(db.from(tables.stores).select('*').order('nombre_display')),
                    messageRows(db.from(tables.messages).select('*').order('creado_en', { ascending: false })),
                    messageRows(db.from(tables.messageDestinations).select('*')),
                    messageRows(db.from(tables.messageStates).select('*'))
                ]);
                this.stores = stores;
                this.messages = messages;
                this.destinations = destinations;
                this.messageStates = states;
                return;
            }

            const [messages, states] = await Promise.all([
                messageRows(db.from(tables.messages).select('*').eq('activo', true).order('creado_en', { ascending: false })),
                userId ? messageRows(db.from(tables.messageStates).select('*').eq('usuario_id', userId)) : Promise.resolve([])
            ]);
            this.messages = messages;
            this.messageStates = states;
        }

        render() {
            if (this.session.isManager) {
                this.renderManager();
                return;
            }
            this.renderMailbox();
        }

        renderMailbox() {
            const pending = this.filteredMailboxEntries(false);
            const archived = this.filteredMailboxEntries(true);
            const visible = this.mailboxFilter === 'archived' ? archived : pending;
            const actions = iconButton('refresh', 'mobileApp.reload()', 'Actualizar');
            shell('messages', 'Buzón de Mensajes', `${pending.length} pendientes - ${archived.length} archivados`, actions, `
                ${this.mailboxToolbar(pending.length, archived.length)}
                ${visible.length ? visible.map((entry) => this.mailboxCard(entry, this.mailboxFilter === 'archived')).join('') : emptyState(this.mailboxFilter === 'archived' ? 'inventory_2' : 'mark_email_read', this.mailboxFilter === 'archived' ? 'Sin archivados' : 'Buzón al día', this.mailboxFilter === 'archived' ? 'Los mensajes vistos o completados aparecerán aquí.' : 'No tienes mensajes pendientes.')}
            `);
        }

        mailboxToolbar(pendingCount, archivedCount) {
            return `
                <section class="message-toolbar app-card">
                    <div class="app-segment">
                        <button class="${this.mailboxFilter === 'pending' ? 'active' : ''}" onclick="mobileApp.setMailboxFilter('pending')">Pendientes (${pendingCount})</button>
                        <button class="${this.mailboxFilter === 'archived' ? 'active' : ''}" onclick="mobileApp.setMailboxFilter('archived')">Archivados (${archivedCount})</button>
                    </div>
                    <label class="app-search"><span class="material-icons">search</span><input value="${h(this.search)}" oninput="mobileApp.setMessageSearch(this.value)" placeholder="Buscar mensajes o tareas"></label>
                </section>`;
        }

        filteredMailboxEntries(archived) {
            const needle = normalizeSearch(this.search);
            return messageOccurrenceEntries(this.messages, this.messageStates, archived)
                .filter((entry) => {
                    if (!needle) return true;
                    return normalizeSearch(`${messageEntryTitle(entry)} ${messagePreview(entry.message)} ${asText(entry.message.detalle)}`).includes(needle);
                });
        }

        mailboxEntryByKey(messageId, occurrenceKey, archived = false) {
            return messageOccurrenceEntries(this.messages, this.messageStates, archived)
                .find((entry) => asInt(entry.message.id) === asInt(messageId) && asText(entry.occurrenceKey) === asText(occurrenceKey));
        }

        mailboxCard(entry, archived) {
            const title = messageEntryTitle(entry);
            const action = messageActionLabel(entry.message);
            const archivedLabel = archived && entry.state
                ? `<span class="message-archive-label">Archivado ${h(dateTimeInGuayaquil(entry.state.archivado_en || entry.state.completado_en || entry.state.visto_en))}</span>`
                : '';
            return `
                <article class="message-mail-card app-card" onclick="mobileApp.openMailboxMessage(${asInt(entry.message.id)}, '${h(entry.occurrenceKey)}', ${archived ? 'true' : 'false'})">
                    <span class="message-mail-icon"><span class="material-icons">${messageKindIcon(entry.message)}</span></span>
                    <span class="min-w-0">
                        <strong>${h(title)}</strong>
                        <small>${h(messagePreview(entry.message))}</small>
                        <span class="message-card-meta">
                            ${messageDueBadge(entry)}
                            ${archivedLabel}
                        </span>
                    </span>
                    ${archived ? '<span class="material-icons text-slate-400">chevron_right</span>' : `<button type="button" class="message-check-btn large" title="${h(action)}" aria-label="${h(action)}" onclick="event.stopPropagation(); mobileApp.markMailboxMessage(${asInt(entry.message.id)}, '${h(entry.occurrenceKey)}')"><span class="material-icons">${messageActionIcon(entry.message)}</span></button>`}
                </article>`;
        }

        setMailboxFilter(filter) {
            this.mailboxFilter = filter === 'archived' ? 'archived' : 'pending';
            this.render();
        }

        setMessageSearch(value) {
            this.search = value;
            this.render();
        }

        async openMailboxMessage(messageId, occurrenceKey, archived = false) {
            const entry = this.mailboxEntryByKey(messageId, occurrenceKey, archived)
                || this.mailboxEntryByKey(messageId, occurrenceKey, !archived);
            if (!entry) return;
            const isArchived = isMessageArchived(entry.message, entry.state);
            const result = await Swal.fire({
                title: messageEntryTitle(entry),
                html: messageDetailHtml(entry),
                showCloseButton: true,
                showCancelButton: !isArchived,
                showConfirmButton: !isArchived,
                confirmButtonText: messageActionLabel(entry.message),
                cancelButtonText: 'Cerrar'
            });
            if (result.isConfirmed) await this.markMailboxMessage(messageId, occurrenceKey);
        }

        async markMailboxMessage(messageId, occurrenceKey) {
            const entry = this.mailboxEntryByKey(messageId, occurrenceKey, false);
            if (!entry) return;
            try {
                await archiveMessageEntry(entry);
                await this.reload();
                Swal.fire({ icon: 'success', title: messageAction(entry.message) === 'completado' ? 'Tarea completada' : 'Mensaje archivado', timer: 1300, showConfirmButton: false });
            } catch (error) {
                Swal.fire('Error', error.message || 'No se pudo actualizar el mensaje', 'error');
            }
        }

        renderManager() {
            const total = this.messages.length;
            const active = this.messages.filter((message) => message.activo !== false).length;
            const monthly = this.messages.filter((message) => asText(message.recurrencia) === 'mensual').length;
            const actions = iconButton('add_circle', 'mobileApp.openMessageForm()', 'Nuevo mensaje', false, 'primary')
                + iconButton('refresh', 'mobileApp.reload()', 'Actualizar');
            shell('messages', 'Planificar mensajes', `${active}/${total} activos`, actions, `
                <section class="stat-row three">
                    ${statCard('Mensajes', total, 'inbox')}
                    ${statCard('Activos', active, 'notifications_active', '#0E9F8F')}
                    ${statCard('Mensuales', monthly, 'event_repeat', '#2563EB')}
                </section>
                ${this.messages.length ? this.messages.map((message) => this.adminMessageCard(message)).join('') : emptyState('inbox', 'Sin mensajes', 'Crea el primer aviso o tarea para los locales.')}
            `);
        }

        adminMessageCard(message) {
            const targets = this.targetLabel(message);
            const status = message.activo === false ? miniChip('Inactivo', '#94a3b8') : miniChip('Activo', '#0E9F8F');
            const recurrence = asText(message.recurrencia) === 'mensual'
                ? `Mensual: día ${asInt(message.dia_publicacion_mensual, 1)}${message.dia_vencimiento_mensual ? `, vence día ${asInt(message.dia_vencimiento_mensual)}` : ''}`
                : `Desde ${shortDateLabel(asText(message.publicar_en).slice(0, 10))}${message.vence_en ? `, vence ${shortDateLabel(asText(message.vence_en).slice(0, 10))}` : ''}`;
            return `
                <article class="message-admin-card app-card">
                    <span class="message-mail-icon"><span class="material-icons">${messageKindIcon(message)}</span></span>
                    <span class="min-w-0">
                        <strong>${h(asText(message.titulo, 'Mensaje'))}</strong>
                        <small>${h(messagePreview(message))}</small>
                        <span class="message-card-meta">${status}${miniChip(asText(message.tipo) === 'tarea' ? 'Tarea' : 'Aviso', asText(message.tipo) === 'tarea' ? '#2563EB' : '#E85D75')}<span class="message-archive-label">${h(recurrence)}</span><span class="message-archive-label">${h(targets)}</span></span>
                    </span>
                    <span class="message-admin-actions">
                        <button type="button" class="planner-icon-btn" title="Editar" onclick="mobileApp.openMessageForm(${asInt(message.id)})"><span class="material-icons">edit</span></button>
                        <button type="button" class="planner-icon-btn" title="${message.activo === false ? 'Activar' : 'Desactivar'}" onclick="mobileApp.toggleMessageActive(${asInt(message.id)})"><span class="material-icons">${message.activo === false ? 'toggle_off' : 'toggle_on'}</span></button>
                    </span>
                </article>`;
        }

        destinationsFor(messageId) {
            return this.destinations.filter((destination) => asInt(destination.mensaje_id) === asInt(messageId));
        }

        targetLabel(message) {
            const destinations = this.destinationsFor(message.id);
            if (!destinations.length || destinations.some((destination) => asText(destination.alcance) === 'todos')) return 'Todos los locales';
            return destinations
                .map((destination) => asText(byId(this.stores, destination.tienda_id)?.nombre_display, `Tienda ${asInt(destination.tienda_id)}`))
                .join(', ');
        }

        messageById(messageId) {
            return this.messages.find((message) => asInt(message.id) === asInt(messageId)) || null;
        }

        async openMessageForm(messageId = null) {
            if (!this.session.isManager) return;
            const message = this.messageById(messageId) || null;
            const destinations = message ? this.destinationsFor(message.id) : [];
            const result = await Swal.fire({
                title: message ? 'Editar mensaje' : 'Nuevo mensaje',
                html: this.messageFormHtml(message, destinations),
                width: 760,
                showCancelButton: true,
                confirmButtonText: 'Guardar',
                cancelButtonText: 'Cancelar',
                didOpen: () => this.syncMessageFormMode(),
                preConfirm: () => this.collectMessageForm()
            });
            if (!result.value) return;
            await this.saveMessageForm(message, result.value);
        }

        messageFormHtml(message, destinations) {
            const hasStoreTargets = destinations.some((destination) => asText(destination.alcance) === 'tienda');
            const selectedStores = new Set(destinations.map((destination) => asInt(destination.tienda_id)).filter(Boolean));
            const target = hasStoreTargets ? 'tienda' : 'todos';
            const type = asText(message?.tipo, 'aviso');
            const recurrence = asText(message?.recurrencia, 'ninguna');
            const publish = asText(message?.publicar_en).slice(0, 10) || todayKeyInGuayaquil();
            const due = asText(message?.vence_en).slice(0, 10);
            return `
                <div class="message-form-grid text-left">
                    <label>Título<input id="msg-title" class="w-full p-3 border rounded-xl mt-1" value="${h(asText(message?.titulo))}" placeholder="Ej. Enviar Lista de Ingresos/Egresos"></label>
                    <label>Resumen<input id="msg-summary" class="w-full p-3 border rounded-xl mt-1" value="${h(asText(message?.resumen))}" placeholder="Texto corto para el buzón"></label>
                    <label class="message-form-wide">Detalle<textarea id="msg-detail" class="w-full p-3 border rounded-xl mt-1" rows="4" placeholder="Información completa, promociones o instrucciones">${h(asText(message?.detalle))}</textarea></label>
                    <label>Tipo<select id="msg-type" class="w-full p-3 border rounded-xl mt-1" onchange="mobileApp.syncMessageFormMode()"><option value="aviso" ${type === 'aviso' ? 'selected' : ''}>Aviso</option><option value="tarea" ${type === 'tarea' ? 'selected' : ''}>Tarea</option></select></label>
                    <label>Acción<select id="msg-action" class="w-full p-3 border rounded-xl mt-1"><option value="visto" ${messageAction(message || { tipo: type }) === 'visto' ? 'selected' : ''}>Visto</option><option value="completado" ${messageAction(message || { tipo: type }) === 'completado' ? 'selected' : ''}>Completado</option></select></label>
                    <label>Destino<select id="msg-target" class="w-full p-3 border rounded-xl mt-1" onchange="mobileApp.syncMessageFormMode()"><option value="todos" ${target === 'todos' ? 'selected' : ''}>Todos los locales</option><option value="tienda" ${target === 'tienda' ? 'selected' : ''}>Locales específicos</option></select></label>
                    <label>Recurrencia<select id="msg-recurrence" class="w-full p-3 border rounded-xl mt-1" onchange="mobileApp.syncMessageFormMode()"><option value="ninguna" ${recurrence === 'ninguna' ? 'selected' : ''}>Sin recurrencia</option><option value="mensual" ${recurrence === 'mensual' ? 'selected' : ''}>Mensual</option></select></label>
                    <label>Publicar desde<input id="msg-publish" type="date" class="w-full p-3 border rounded-xl mt-1" value="${h(publish)}"></label>
                    <label id="msg-due-wrap">Fecha límite<input id="msg-due" type="date" class="w-full p-3 border rounded-xl mt-1" value="${h(due)}"></label>
                    <div id="msg-monthly-wrap" class="message-form-wide message-monthly-row">
                        <label>Día de publicación mensual<input id="msg-monthly-publish" type="number" min="1" max="28" class="w-full p-3 border rounded-xl mt-1" value="${asInt(message?.dia_publicacion_mensual, 1)}"></label>
                        <label>Día límite mensual<input id="msg-monthly-due" type="number" min="1" max="31" class="w-full p-3 border rounded-xl mt-1" value="${asInt(message?.dia_vencimiento_mensual, 5)}"></label>
                    </div>
                    <div id="msg-store-wrap" class="message-form-wide message-store-picker">
                        ${this.stores.map((store) => `
                            <label><input type="checkbox" value="${asInt(store.id)}" ${selectedStores.has(asInt(store.id)) ? 'checked' : ''}>${h(asText(store.nombre_display, 'Tienda'))}</label>
                        `).join('')}
                    </div>
                    <label class="message-form-wide message-active-row"><input id="msg-active" type="checkbox" ${message?.activo === false ? '' : 'checked'}> Activo</label>
                </div>`;
        }

        syncMessageFormMode() {
            const type = document.getElementById('msg-type')?.value || 'aviso';
            const action = document.getElementById('msg-action');
            if (action) action.value = type === 'tarea' ? 'completado' : 'visto';
            const target = document.getElementById('msg-target')?.value || 'todos';
            const storeWrap = document.getElementById('msg-store-wrap');
            if (storeWrap) storeWrap.hidden = target !== 'tienda';
            const recurrence = document.getElementById('msg-recurrence')?.value || 'ninguna';
            const monthlyWrap = document.getElementById('msg-monthly-wrap');
            const dueWrap = document.getElementById('msg-due-wrap');
            if (monthlyWrap) monthlyWrap.hidden = recurrence !== 'mensual';
            if (dueWrap) dueWrap.hidden = recurrence === 'mensual';
        }

        collectMessageForm() {
            const title = asText(document.getElementById('msg-title')?.value).trim();
            if (!title) {
                Swal.showValidationMessage('El título es obligatorio.');
                return false;
            }
            const target = document.getElementById('msg-target')?.value || 'todos';
            const storeIds = [...document.querySelectorAll('#msg-store-wrap input[type="checkbox"]:checked')]
                .map((input) => asInt(input.value))
                .filter(Boolean);
            if (target === 'tienda' && !storeIds.length) {
                Swal.showValidationMessage('Selecciona al menos un local.');
                return false;
            }
            const recurrence = document.getElementById('msg-recurrence')?.value || 'ninguna';
            const publish = document.getElementById('msg-publish')?.value || todayKeyInGuayaquil();
            const monthlyPublish = asInt(document.getElementById('msg-monthly-publish')?.value, 1);
            const monthlyDue = asInt(document.getElementById('msg-monthly-due')?.value, monthlyPublish);
            if (recurrence === 'mensual' && (monthlyPublish < 1 || monthlyPublish > 28 || monthlyDue < 1 || monthlyDue > 31)) {
                Swal.showValidationMessage('Los días mensuales deben estar en rangos válidos.');
                return false;
            }
            return {
                message: {
                    titulo: title,
                    resumen: asText(document.getElementById('msg-summary')?.value).trim() || null,
                    detalle: asText(document.getElementById('msg-detail')?.value).trim() || null,
                    tipo: document.getElementById('msg-type')?.value || 'aviso',
                    accion_requerida: document.getElementById('msg-action')?.value || 'visto',
                    publicar_en: publish,
                    vence_en: recurrence === 'mensual' ? null : (document.getElementById('msg-due')?.value || null),
                    recurrencia: recurrence,
                    dia_publicacion_mensual: recurrence === 'mensual' ? monthlyPublish : null,
                    dia_vencimiento_mensual: recurrence === 'mensual' ? monthlyDue : null,
                    activo: document.getElementById('msg-active')?.checked !== false,
                    actualizado_en: new Date().toISOString()
                },
                target,
                storeIds
            };
        }

        async saveMessageForm(existing, value) {
            try {
                const userId = asInt(sessionStorage.getItem('staffPlannerUserId')) || null;
                let messageId = asInt(existing?.id);
                if (existing) {
                    await rows(db.from(tables.messages).update(value.message).eq('id', messageId).select());
                } else {
                    const inserted = await rows(db.from(tables.messages).insert({ ...value.message, creado_por: userId }).select());
                    messageId = asInt(inserted[0]?.id);
                }
                if (!messageId) throw new Error('No se pudo identificar el mensaje guardado.');

                if (existing) {
                    await rows(db.from(tables.messageDestinations).delete().eq('mensaje_id', messageId).select());
                }
                const destinations = value.target === 'todos'
                    ? [{ mensaje_id: messageId, alcance: 'todos', tienda_id: null }]
                    : value.storeIds.map((storeId) => ({ mensaje_id: messageId, alcance: 'tienda', tienda_id: storeId }));
                await rows(db.from(tables.messageDestinations).insert(destinations).select());
                await this.reload();
                Swal.fire({ icon: 'success', title: 'Mensaje guardado', timer: 1300, showConfirmButton: false });
            } catch (error) {
                Swal.fire('Error', error.message || 'No se pudo guardar el mensaje', 'error');
            }
        }

        async toggleMessageActive(messageId) {
            const message = this.messageById(messageId);
            if (!message) return;
            try {
                await rows(db.from(tables.messages).update({ activo: message.activo === false, actualizado_en: new Date().toISOString() }).eq('id', asInt(messageId)).select());
                await this.reload();
            } catch (error) {
                Swal.fire('Error', error.message || 'No se pudo actualizar el mensaje', 'error');
            }
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
        if (window.StaffPlanner.getRoleId() === 3 && !['store', 'messages', 'planner', 'internal', 'nav'].includes(view)) {
            window.location.href = 'calendario-tienda.html';
            return Promise.resolve(null);
        }
        const map = {
            planner: PlannerView,
            store: StoreMonthView,
            internal: InternalMonthView,
            messages: MessagesView,
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
