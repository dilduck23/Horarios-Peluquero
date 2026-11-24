import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

function view() {
    const source = readFileSync(new URL('../js/mobile-web-app.js', import.meta.url), 'utf8');
    const start = source.indexOf('class PickupsView extends BaseView');
    const end = source.indexOf('class SalesView extends BaseView', start);
    let modal;
    let markup;
    let calls = 0;
    const FixedDate = class extends Date {
        constructor(...args) { super(...(args.length ? args : ['2026-11-24T15:00:00Z'])); }
        static now() { return Date.parse('2026-11-24T15:00:00Z'); }
    };
    const Class = runInNewContext(`${source.slice(start, end)}\nPickupsView`, {
        BaseView: class { constructor() { this.session = { isManager: true }; } },
        window: { location: { hostname: 'localhost', origin: 'http://localhost:3001' } },
        document: { querySelectorAll: () => [] },
        Date: FixedDate,
        officialClock: { offsetMs: 0 },
        h: (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
        pickupImageUrl: () => '',
        shell: (_active, _title, _subtitle, _actions, content) => { markup = content; },
        Swal: { isVisible: () => false, fire: async (options) => { modal = options; calls++; return { isConfirmed: false }; } },
    });
    const app = new Class();
    app.pending = [{ id: 'preorder', orderNumber: 99, customerName: 'Prueba',
        createdAt: '2026-11-24T15:00Z', pickupLocation: { name: 'Tienda' },
        isPreorder: true, fulfillmentNotBefore: '2026-11-26T15:00Z', pickupDateBlocked: true,
        readyToDeliver: true, canMarkReady: true, hasPickupCode: true,
        items: [{ title: 'Shampoo Black Friday', sku: 'BF01', quantity: 3 }],
    }];
    return { app, modal: () => modal, markup: () => markup, calls: () => calls };
}

test('future preorders show products for separation without any code input or confirmation', async () => {
    const f = view();
    await f.app.openPickup(0);
    assert.equal(f.modal().showConfirmButton, false);
    assert.match(f.modal().html, /Precompra/);
    assert.match(f.modal().html, /Productos para separar/);
    assert.match(f.modal().html, /Shampoo Black Friday/);
    assert.match(f.modal().html, /BF01/);
    assert.match(f.modal().html, /26 nov 2026/);
    assert.doesNotMatch(f.modal().html, /id="pickup-dialog-code-input"|id="pickup-dialog-verified"/);
});

test('preorder list remains clickable and shows its tag, release date and locked state', () => {
    const f = view();
    f.app.render();
    assert.match(f.markup(), /Precompra/);
    assert.match(f.markup(), /Retiro desde:/);
    assert.match(f.markup(), /Retiro bloqueado/);
    assert.match(f.markup(), /mobileApp.openPickup\(0\)/);
});

test('the frontend blocks early readiness even when a stale API claims it is ready', async () => {
    const f = view();
    await f.app.markPickupReady(0);
    assert.equal(f.calls(), 0);
    delete f.app.pending[0].pickupDateBlocked;
    await f.app.openPickup(0);
    assert.equal(f.modal().showConfirmButton, false);
});

test('released preorders retain the tag and enable normal code verification', async () => {
    const f = view();
    Object.assign(f.app.pending[0], { pickupDateBlocked: false, fulfillmentNotBefore: '2026-11-23T15:00Z' });
    await f.app.openPickup(0);
    assert.equal(f.modal().showConfirmButton, true);
    assert.match(f.modal().html, /Precompra/);
    assert.match(f.modal().html, /Productos a entregar/);
    assert.match(f.modal().html, /id="pickup-dialog-code-input"/);
    assert.match(f.modal().html, /id="pickup-dialog-verified"/);
});

test('regular paid pickups preserve their existing ready and delivery actions', async () => {
    const f = view();
    Object.assign(f.app.pending[0], { isPreorder: false, pickupDateBlocked: false, fulfillmentNotBefore: null });
    await f.app.openPickup(0);
    assert.equal(f.modal().showConfirmButton, true);
    assert.doesNotMatch(f.modal().html, /pickup-preorder-notice/);
    assert.match(f.modal().html, /id="pickup-dialog-code-input"/);
});
