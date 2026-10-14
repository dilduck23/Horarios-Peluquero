(function (window) {
    const db = window.StaffPlanner.db;
    const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const apiUrl = local ? `${window.location.origin}/api/horarios/vendor-integrations` : 'https://elpeluquero.ec/api/horarios/vendor-integrations';
    const content = document.getElementById('vendor-integration-content');
    const status = document.getElementById('vendor-integration-status');
    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const number = (value) => Number.isInteger(Number(value)) ? Number(value) : 0;
    const normalizeSearch = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const providerCountLabel = (count) => `${count} ${count === 1 ? 'proveedor encontrado' : 'proveedores encontrados'}`;
    let data = { webProviders: [], links: [], proposals: [], shifts: [], stores: [], categories: [], brands: [], promoters: [] };
    let tab = 'proposals';

    async function token() {
        const { data: auth, error } = await db.auth.getSession();
        if (error || !auth?.session?.access_token) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
        return auth.session.access_token;
    }

    async function request(method, body) {
        const response = await fetch(apiUrl, {
            method,
            headers: { Authorization: `Bearer ${await token()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {}),
            cache: 'no-store'
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success) throw new Error(result?.error || 'No se pudo conectar con la web.');
        return result.data;
    }

    function setStatus(message, tone = 'normal') {
        status.textContent = message;
        status.className = `mb-4 rounded-xl px-4 py-3 text-sm ${tone === 'error' ? 'bg-red-50 text-red-800' : tone === 'success' ? 'bg-green-50 text-green-800' : 'bg-white text-slate-600'}`;
    }

    function setTab(next) {
        tab = next === 'links' ? 'links' : 'proposals';
        document.getElementById('tab-proposals').className = `rounded-xl px-4 py-3 text-sm font-bold ${tab === 'proposals' ? 'bg-rose-500 text-white' : 'bg-white'}`;
        document.getElementById('tab-links').className = `rounded-xl px-4 py-3 text-sm font-bold ${tab === 'links' ? 'bg-rose-500 text-white' : 'bg-white'}`;
        document.getElementById('tab-proposals').setAttribute('aria-selected', String(tab === 'proposals'));
        document.getElementById('tab-links').setAttribute('aria-selected', String(tab === 'links'));
        render();
    }

    function horariosProviders() {
        const unique = new Map();
        data.brands.filter((brand) => brand.activo !== false).forEach((brand) => {
            if (!unique.has(number(brand.idProveedor))) unique.set(number(brand.idProveedor), brand.proveedor);
        });
        return [...unique]
            .map(([id, name]) => ({ id, name: String(name || `Proveedor ${id}`) }))
            .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    }

    function providerOptions(providers) {
        return providers.map((provider) => `<option value="${number(provider.id)}">${esc(provider.name)} · ID ${number(provider.id)}</option>`).join('');
    }

    function webProviders() {
        return data.webProviders.map((provider) => ({
            id: number(provider.idProveedor),
            name: provider.proveedorNombre,
            searchText: [provider.proveedorNombre, provider.idProveedor, ...(provider.accounts || []).flatMap((account) => [account.name, account.email])].join(' ')
        }));
    }

    function filterProviderSelect(kind) {
        const isWeb = kind === 'web';
        const input = document.getElementById(isWeb ? 'link-web-provider-search' : 'link-horarios-provider-search');
        const select = document.getElementById(isWeb ? 'link-web-provider' : 'link-horarios-provider');
        const counter = document.getElementById(isWeb ? 'link-web-provider-count' : 'link-horarios-provider-count');
        if (!input || !select || !counter) return;
        const query = normalizeSearch(input.value);
        const providers = (isWeb ? webProviders() : horariosProviders().map((provider) => ({ ...provider, searchText: `${provider.name} ${provider.id}` })))
            .filter((provider) => !query || normalizeSearch(provider.searchText).includes(query));
        const currentValue = select.value;
        select.innerHTML = `<option value="">${providers.length ? 'Seleccionar…' : 'Sin coincidencias'}</option>${providerOptions(providers)}`;
        if (providers.some((provider) => String(provider.id) === currentValue)) select.value = currentValue;
        counter.textContent = providerCountLabel(providers.length);
        if (isWeb && !select.value) updateLinkedAccounts();
    }

    function renderLinks() {
        content.innerHTML = `
            <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 class="text-lg font-black">Enlazar proveedores</h2>
                <p class="mt-1 text-sm text-slate-500">El enlace se aplica automáticamente a todas las cuentas y correos autorizados para el proveedor web, también a los que se agreguen después.</p>
                <form id="vendor-link-form" class="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                        <label for="link-web-provider-search" class="text-sm font-bold">Buscar proveedor web</label>
                        <div class="vendor-search-wrap"><span class="material-icons" aria-hidden="true">search</span><input id="link-web-provider-search" type="search" class="vendor-search-input" placeholder="Nombre, ID, cuenta o correo" autocomplete="off"></div>
                        <span id="link-web-provider-count" class="vendor-result-count" aria-live="polite">${providerCountLabel(data.webProviders.length)}</span>
                        <label for="link-web-provider" class="mt-3 block text-sm font-bold">Proveedor web autorizado</label>
                        <select id="link-web-provider" required class="mt-1 w-full rounded-xl border p-3"><option value="">Seleccionar…</option>${providerOptions(webProviders())}</select>
                    </div>
                    <div>
                        <label for="link-horarios-provider-search" class="text-sm font-bold">Buscar proveedor en Horarios</label>
                        <div class="vendor-search-wrap"><span class="material-icons" aria-hidden="true">search</span><input id="link-horarios-provider-search" type="search" class="vendor-search-input" placeholder="Nombre o ID del proveedor" autocomplete="off"></div>
                        <span id="link-horarios-provider-count" class="vendor-result-count" aria-live="polite">${providerCountLabel(horariosProviders().length)}</span>
                        <label for="link-horarios-provider" class="mt-3 block text-sm font-bold">Proveedor en Horarios</label>
                        <select id="link-horarios-provider" required class="mt-1 w-full rounded-xl border p-3"><option value="">Seleccionar…</option>${providerOptions(horariosProviders())}</select>
                    </div>
                    <p id="linked-accounts" class="text-sm text-slate-600 md:col-span-2" aria-live="polite">Elige un proveedor web para ver sus cuentas autorizadas.</p>
                    <button type="submit" class="rounded-xl bg-rose-500 px-4 py-3 font-bold text-white md:col-span-2">Guardar enlace</button>
                </form>
            </section>
            <section class="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 class="text-lg font-black">Enlaces activos (${data.links.length})</h2>
                <div class="mt-3 space-y-2">${data.links.map((link) => {
                    const web = data.webProviders.find((item) => number(item.idProveedor) === number(link.webProviderId));
                    const accounts = web?.accounts?.map((account) => esc(account.email)).join(', ') || 'Sin cuentas web activas';
                    return `<div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm"><span><strong>${esc(web?.proveedorNombre || `Web #${link.webProviderId}`)}</strong> → ${esc(link.horariosProviderName || `Horarios #${link.horariosProviderId}`)}<br><span class="text-slate-500">Correos autorizados: ${accounts}</span></span><button type="button" class="rounded-lg border border-red-200 px-3 py-2 font-bold text-red-700" onclick="vendorIntegration.unlink(${number(link.webProviderId)})">Desenlazar</button></div>`;
                }).join('') || '<p class="text-sm text-slate-500">Todavía no hay enlaces.</p>'}</div>
            </section>`;
        document.getElementById('link-web-provider').addEventListener('change', updateLinkedAccounts);
        document.getElementById('link-web-provider-search').addEventListener('input', () => filterProviderSelect('web'));
        document.getElementById('link-horarios-provider-search').addEventListener('input', () => filterProviderSelect('horarios'));
        document.getElementById('vendor-link-form').addEventListener('submit', async (event) => {
            event.preventDefault();
            const button = event.currentTarget.querySelector('button[type="submit"]');
            button.disabled = true;
            button.textContent = 'Guardando…';
            try {
                await request('POST', {
                    action: 'link',
                    webProviderId: number(document.getElementById('link-web-provider').value),
                    horariosProviderId: number(document.getElementById('link-horarios-provider').value)
                });
                if (await load()) setStatus('Enlace guardado para todas las cuentas autorizadas.', 'success');
            } catch (error) { setStatus(error.message, 'error'); }
            finally { if (button.isConnected) { button.disabled = false; button.textContent = 'Guardar enlace'; } }
        });
    }

    function updateLinkedAccounts() {
        const provider = data.webProviders.find((item) => number(item.idProveedor) === number(document.getElementById('link-web-provider').value));
        document.getElementById('linked-accounts').textContent = provider
            ? `Cuentas y correos con acceso automático: ${provider.accounts.map((account) => `${account.name} (${account.email})`).join(', ')}`
            : 'Elige un proveedor web para ver sus cuentas autorizadas.';
    }

    function proposalConflict(proposal) {
        const date = String(proposal.date).slice(0, 10);
        const shifts = data.shifts.filter((shift) => String(shift.fecha).slice(0, 10) === date);
        const promoterId = proposal.horariosPromoterId || proposal.vendorPromotor?.horariosPromoterId;
        const already = promoterId ? shifts.find((shift) => number(shift.impulsadora_id) === number(promoterId)) : null;
        if (already && number(already.tienda_id) !== number(proposal.horariosStoreId)) {
            const store = data.stores.find((item) => number(item.id) === number(already.tienda_id));
            return `⚠️ Sobreescribiría el turno de esta impulsadora en ${store?.nombre_display || 'otra tienda'}. Hay que modificar el horario antes de aprobar.`;
        }
        const store = data.stores.find((item) => number(item.id) === number(proposal.horariosStoreId));
        const inStore = shifts.filter((shift) => number(shift.tienda_id) === number(proposal.horariosStoreId));
        if (!already && number(store?.cupo_total) > 0 && inStore.length >= number(store.cupo_total)) {
            return `⚠️ Cupo total lleno (${inStore.length}/${store.cupo_total}). Hay que modificar el horario antes de aprobar.`;
        }
        return already ? 'Este turno ya está registrado en esa tienda; al aprobar se vinculará sin duplicarlo.' : '';
    }

    function renderProposals() {
        content.innerHTML = `
            <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-lg font-black">Propuestas pendientes (${data.proposals.length})</h2><p class="text-sm text-slate-500">Se volverán a validar cupos, zona y turno al aprobar.</p></div><button type="button" class="rounded-xl border px-4 py-2 font-bold" onclick="vendorIntegration.load()">Actualizar</button></div>
                <div class="mt-4 space-y-3">${data.proposals.map((proposal) => {
                    const store = data.stores.find((item) => number(item.id) === number(proposal.horariosStoreId));
                    const category = data.categories.find((item) => number(item.id) === number(proposal.horariosCategoryId));
                    const conflict = proposalConflict(proposal);
                    const isNew = Boolean(proposal.vendorPromotorId) && !(proposal.horariosPromoterId || proposal.vendorPromotor?.horariosPromoterId);
                    return `<article class="rounded-xl border border-slate-200 p-4"><div class="flex flex-wrap items-start justify-between gap-2"><div><strong class="text-base">${esc(proposal.promoterName)}</strong><p class="text-sm text-slate-600">${esc(proposal.vendorUser?.name || '')} · ${esc(String(proposal.date).slice(0, 10))} · ${esc(store?.nombre_display || 'Tienda')}</p><p class="text-xs text-slate-500">${esc(category?.descripcion || 'Categoría')} · ${isNew ? 'Nueva vendedora' : 'Impulsadora existente'}</p></div><span class="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">Por aprobar</span></div>
                        ${proposal.note ? `<p class="mt-2 text-sm">Nota: ${esc(proposal.note)}</p>` : ''}
                        ${conflict ? `<p class="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">${esc(conflict)}</p>` : ''}
                        <div class="mt-4 flex flex-wrap gap-2"><button type="button" class="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white" onclick="vendorIntegration.review('${esc(proposal.id)}','approve')">Aprobar turno</button><button type="button" class="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700" onclick="vendorIntegration.review('${esc(proposal.id)}','reject')">Pedir cambio / Rechazar</button></div>
                    </article>`;
                }).join('') || '<p class="py-5 text-center text-sm text-slate-500">No hay propuestas pendientes.</p>'}</div>
            </section>`;
    }

    function render() { tab === 'links' ? renderLinks() : renderProposals(); }

    async function load() {
        try {
            const next = await request('GET');
            data = next;
            setStatus('Datos actualizados.');
            render();
            return true;
        } catch (error) { setStatus(error.message, 'error'); return false; }
    }

    async function unlink(webProviderId) {
        const answer = await Swal.fire({ title: 'Desenlazar proveedor', text: 'Todas las cuentas web autorizadas dejarán de ver los turnos de este proveedor.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Desenlazar', cancelButtonText: 'Cancelar' });
        if (!answer.isConfirmed) return;
        try { await request('POST', { action: 'unlink', webProviderId }); if (await load()) setStatus('Enlace retirado.', 'success'); }
        catch (error) { setStatus(error.message, 'error'); }
    }

    async function review(proposalId, action) {
        const proposal = data.proposals.find((item) => item.id === proposalId);
        if (!proposal) return;
        const conflict = proposalConflict(proposal);
        if (action === 'approve' && conflict.startsWith('⚠️')) {
            await Swal.fire('Hay que modificar el horario', conflict, 'warning');
            return;
        }
        let reviewNote = '';
        let salesCode = '';
        if (action === 'reject') {
            const answer = await Swal.fire({ title: 'Solicitar modificación', input: 'textarea', inputLabel: '¿Qué debe corregir el proveedor?', inputValidator: (value) => !value?.trim() ? 'Escribe la corrección necesaria.' : undefined, showCancelButton: true, confirmButtonText: 'Enviar devolución', cancelButtonText: 'Cancelar' });
            if (!answer.isConfirmed) return;
            reviewNote = answer.value.trim();
        } else if (proposal.vendorPromotorId && !(proposal.horariosPromoterId || proposal.vendorPromotor?.horariosPromoterId)) {
            const answer = await Swal.fire({ title: 'Código de venta de la nueva vendedora', text: 'Se creará en Horarios y luego se aprobará su turno.', input: 'text', inputAttributes: { inputmode: 'numeric', maxlength: '12' }, inputValidator: (value) => !/^\d{1,12}$/.test(value || '') ? 'Ingresa un código de venta numérico.' : undefined, showCancelButton: true, confirmButtonText: 'Crear y aprobar', cancelButtonText: 'Cancelar' });
            if (!answer.isConfirmed) return;
            salesCode = answer.value.trim();
        } else {
            const answer = await Swal.fire({ title: 'Aprobar turno', text: 'Se registrará en el horario de la tienda.', icon: 'question', showCancelButton: true, confirmButtonText: 'Aprobar', cancelButtonText: 'Cancelar' });
            if (!answer.isConfirmed) return;
        }
        try {
            await request('POST', { action, proposalId, reviewNote, salesCode });
            await load(); setStatus(action === 'approve' ? 'Turno aprobado y registrado.' : 'Propuesta devuelta al proveedor.', 'success');
        } catch (error) { setStatus(error.message, 'error'); }
    }

    function logout() {
        sessionStorage.clear();
        window.location.href = 'login.html';
    }

    function renderUser() {
        const role = sessionStorage.getItem('staffPlannerRoleName') || 'Usuario';
        let user = {};
        try { user = JSON.parse(sessionStorage.getItem('staffPlannerUser') || '{}'); } catch (error) { user = {}; }
        const email = String(user.email || 'Sesión activa');
        document.getElementById('vendor-user-role').textContent = role;
        document.getElementById('vendor-user-email').textContent = email;
        document.getElementById('vendor-user-initial').textContent = email.trim().charAt(0).toUpperCase() || 'U';
    }

    window.vendorIntegration = { load, setTab, unlink, review, logout };
    if (![1, 2].includes(window.StaffPlanner.getRoleId())) {
        window.location.replace('navegacion.html');
    } else {
        renderUser();
        load();
    }
})(window);
