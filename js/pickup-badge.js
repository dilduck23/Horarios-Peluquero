(function (window) {
    const planner = window.StaffPlanner;
    const apiUrl = ['localhost', '127.0.0.1'].includes(window.location.hostname)
        ? `${window.location.origin}/api/horarios/pickups`
        : 'https://elpeluquero.ec/api/horarios/pickups';
    const refreshInterval = 60 * 1000;
    let pendingCount = null;
    let loadedAt = 0;
    let inFlight = null;
    let managedByPickups = false;
    let timer = null;

    function apply() {
        document.querySelectorAll('[data-pickup-badge]').forEach((badge) => {
            const visible = pendingCount !== null && pendingCount > 0;
            badge.hidden = !visible;
            badge.textContent = visible ? (pendingCount > 99 ? '99+' : String(pendingCount)) : '';
            const link = badge.closest('a');
            if (link) link.setAttribute('aria-label', visible
                ? `Retiros, ${pendingCount} ${pendingCount === 1 ? 'pedido pendiente' : 'pedidos pendientes'}`
                : 'Retiros');
        });
    }

    function set(total) {
        if (total === null || total === undefined || total === '') return clear();
        const value = Number(total);
        if (!Number.isSafeInteger(value) || value < 0) return clear();
        pendingCount = value;
        loadedAt = Date.now();
        apply();
    }

    function clear() {
        pendingCount = null;
        loadedAt = 0;
        apply();
    }

    async function refresh(force = false) {
        if (managedByPickups || document.hidden || sessionStorage.getItem('staffPlannerAuth') !== 'true'
            || ![1, 2, 3].includes(planner.getRoleId())) return;
        if (inFlight) return inFlight;
        if (!force && Date.now() - loadedAt < refreshInterval) return;
        inFlight = (async () => {
            const { data, error } = await planner.db.auth.getSession();
            if (error || !data?.session?.access_token) throw new Error('Sesión no disponible');
            const url = new URL(apiUrl);
            url.searchParams.set('page', '1');
            // The API determines the store from the authenticated user. Managers see all stores.
            if (planner.getRoleId() !== 3) url.searchParams.set('locationId', 'all');
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${data.session.access_token}` },
                cache: 'no-store'
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result?.success) throw new Error('No se pudieron cargar los retiros');
            set(result.data?.total);
        })().catch(() => clear()).finally(() => { inFlight = null; });
        return inFlight;
    }

    function mount(options = {}) {
        managedByPickups = options.managedByPickups === true;
        apply();
        if (!managedByPickups) refresh();
        if (!timer) {
            timer = window.setInterval(() => refresh(), refreshInterval);
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) refresh(true);
            });
        }
    }

    window.PickupBadge = { mount, refresh, set, clear };
})(window);
