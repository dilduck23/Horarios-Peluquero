(function (window) {
    const SUPABASE_URL = 'https://cectqtufttubsepyiolr.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_Ow2zQpNDPsLA6on9VBWFgg_Q0_LAc1D';

    const TABLES = {
        stores: 'Tiendas_Razonamiento',
        impulsadoras: 'Tiendas_Impulsadoras',
        schedule: 'Tiendas_Horario',
        attendance: 'Tiendas_Asistencia',
        incidences: 'Tiendas_Faltas',
        roles: 'Tiendas_Roles',
        users: 'Tiendas_Usuarios',
        categories: 'Tiendas_Categorias',
        brandCatalog: 'Tiendas_Marcas_Proveedores',
        internalStaff: 'Tiendas_Personal',
        internalSchedule: 'Tiendas_Personal_Horario',
        audit: 'Tiendas_Registros',
        messages: 'Tiendas_Mensajes',
        messageDestinations: 'Tiendas_Mensajes_Destinos',
        messageStates: 'Tiendas_Mensajes_Estados'
    };

    if (!window.supabase) {
        throw new Error('Supabase JS no está cargado');
    }

    const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    function getRoleId() {
        return parseInt(sessionStorage.getItem('staffPlannerRoleId') || '0', 10) || 0;
    }

    function getTiendaId() {
        return parseInt(sessionStorage.getItem('staffPlannerTiendaId') || '0', 10) || 0;
    }

    function isActiveImpulsadora(person) {
        return person && person.Habilitado !== false;
    }

    function isActiveInternalStaff(person) {
        return person && person.habilitado !== false;
    }

    function isUniqueViolation(error) {
        return error && error.code === '23505';
    }

    function duplicateMessage(error) {
        if (!isUniqueViolation(error)) return error?.message || 'No se pudo guardar el registro';
        return 'Ese turno ya existe o la persona ya tiene un turno asignado ese día.';
    }

    window.StaffPlanner = {
        supabaseUrl: SUPABASE_URL,
        supabaseKey: SUPABASE_KEY,
        db,
        tables: TABLES,
        getRoleId,
        getTiendaId,
        isAdmin: () => getRoleId() === 1,
        canManageSchedules: () => [1, 2].includes(getRoleId()),
        canAccessAdminViews: () => [1, 2, 3].includes(getRoleId()),
        isActiveImpulsadora,
        isActiveInternalStaff,
        isUniqueViolation,
        duplicateMessage
    };
})(window);
