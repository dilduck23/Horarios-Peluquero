(function (window) {
    'use strict';

    // Layout coordinates follow the original 420 x 595 design. A guide occupies
    // the right 148.5 x 210 mm half of landscape A4, as in Web Peluquero.
    const WIDTH = 420;
    const HEIGHT = 595;
    const MM = 210 / HEIGHT;
    const POINTS = MM * 72 / 25.4;
    const fields = [
        { key: 'orderNumber', label: 'Número de orden', max: 30, required: true, placeholder: 'Ej. 2397', wide: true },
        { key: 'customerName', label: 'Nombre del destinatario', pdfLabel: 'Nombre:', x: 98, y: 197, max: 180, required: true, autocomplete: 'name', wide: true },
        { key: 'address', label: 'Dirección', pdfLabel: 'Dirección:', x: 106, y: 221, max: 320, required: true, autocomplete: 'street-address', multiline: true, wide: true },
        { key: 'reference', label: 'Referencia', pdfLabel: 'Referencia:', x: 116, y: 244, max: 320, multiline: true, wide: true },
        { key: 'city', label: 'Ciudad y provincia', pdfLabel: 'Ciudad:', x: 94, y: 268, max: 160, required: true, placeholder: 'Ej. Guayaquil, Guayas', wide: true },
        { key: 'phone', label: 'Teléfono', pdfLabel: 'Teléfono:', x: 102, y: 292, max: 40, required: true, type: 'tel', autocomplete: 'tel' },
        { key: 'idNumber', label: 'Cédula / RUC', pdfLabel: 'Cédula/RUC:', x: 125, y: 339, max: 30 },
        { key: 'email', label: 'Correo electrónico', pdfLabel: 'Correo:', x: 91, y: 315, max: 254, type: 'email', autocomplete: 'email', wide: true }
    ];
    let assetsPromise;

    function escape(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    }

    function clean(value) {
        return String(value || '').normalize('NFC').replace(/[\u2010-\u2015]/g, '-')
            .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
            .replace(/\s+/g, ' ').trim();
    }

    function loadAssets() {
        if (!assetsPromise) {
            assetsPromise = Promise.all(['Mil-Gracias.png', 'En-Camino.png', 'logo-novepsa-sf-negro.png'].map((name) => new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('No se pudieron cargar las imágenes de la guía. Reintenta.'));
                img.src = `assets/guia-envio/${name}`;
            }))).catch((error) => { assetsPromise = null; throw error; });
        }
        return assetsPromise;
    }

    function newDocument() {
        if (!window.jspdf?.jsPDF) throw new Error('No se pudo cargar el generador PDF. Recarga esta página.');
        return new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true });
    }

    function setFont(doc, size, bold = false) {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(size * POINTS);
    }

    // Both renderers use PDF font metrics, so preview and download wrap at the
    // same characters. No splitTextToSize(...)[0] or ellipsis discards user data.
    function fitText(doc, text, width, { max = 13, min = 7.5, lines = 2, bold = false } = {}) {
        const measure = (value, size) => {
            setFont(doc, size, bold);
            return doc.getTextWidth(value) / MM;
        };
        for (let size = max; size >= Math.max(min, 9); size -= .25) {
            if (measure(text, size) <= width) return { size, lines: [text] };
        }
        for (let size = Math.min(max, 10); size >= min; size -= .25) {
            const result = [];
            let line = '';
            for (const word of text.split(' ')) {
                if (line && measure(`${line} ${word}`, size) <= width) { line += ` ${word}`; continue; }
                if (line) { result.push(line); line = ''; }
                for (const char of word) {
                    if (line && measure(line + char, size) > width) { result.push(line); line = ''; }
                    line += char;
                }
            }
            if (line) result.push(line);
            if (result.length <= lines && result.every((value) => measure(value, size) <= width)) return { size, lines: result };
        }
        return null;
    }

    function prepare(doc, values) {
        const issues = {};
        const fitted = {};
        fields.forEach((field) => {
            const value = field.key === 'orderNumber' ? `Orden #${clean(values[field.key]) || '...'}` : clean(values[field.key]) || '-';
            // The built-in Helvetica font supports Latin characters used in
            // Spanish. Flag unsupported glyphs instead of emitting garbled text.
            if (/[^\x20-\x7e\u00a0-\u00ff]/u.test(value)) {
                issues[field.key] = 'Usa letras latinas, números y signos comunes; este campo contiene un símbolo no compatible.';
            }
            fitted[field.key] = fitText(doc, value, field.key === 'orderNumber' ? 138 : 369 - field.x,
                field.key === 'orderNumber' ? { max: 17, min: 8, lines: 1, bold: true } : {});
            if (!fitted[field.key]) issues[field.key] = 'El texto es demasiado largo. Acórtalo para que sea legible dentro de la guía.';
        });
        return { fitted, issues };
    }

    function drawGuide(surface, layout, images) {
        surface.text('¡Gracias por Tu Compra!', 25, 93, 21, true);
        surface.rect(25, 141, 370, 377, 12, '#1e1e1e', null, 2);
        surface.rect(25, 126, 164, 33, 16.5, null, '#141414');
        const order = layout.fitted.orderNumber;
        surface.text(order?.lines[0] || 'Revisa la orden', 39, 149, order?.size || 10, true, '#fff');
        surface.image(images[0], 282, 43, 136, 136);
        fields.filter((field) => field.pdfLabel).forEach((field) => {
            surface.text(field.pdfLabel, 39, field.y, 13, true);
            const fit = layout.fitted[field.key];
            if (layout.issues[field.key]) {
                surface.text('Revisa este campo', field.x, field.y, 9, false, '#b91c1c');
            } else {
                const step = fit.size * 1.1;
                const baseline = fit.lines.length === 1 ? field.y : field.y - 6;
                fit.lines.forEach((line, index) => surface.text(line, field.x, baseline + index * step, fit.size));
            }
        });
        [207, 228, 251, 275, 299, 322, 346].forEach((y) => surface.line(37, y, 369, y, '#bebebe', .5));
        surface.rect(67.5, 372, 285, 61, 10, '#b4b4b4', null, 1);
        surface.text('Recuerda dejar tu reseña del producto en la página', 210, 387, 9.4, false, '#282828', 'center');
        surface.text('Mi cuenta > Mis Reseñas y gana puntos', 210, 403, 10, true, '#282828', 'center');
        surface.text('para increíbles premios.', 210, 419, 10, false, '#282828', 'center');
        surface.image(images[2], 88, 448, 246, 61);
        surface.image(images[1], 20, 488, 99, 99);
        surface.text('Para más información nos puedes contactar a', 125, 536, 10);
        surface.text('nuestro WhatsApp al 099-8519262 o visitar', 125, 550, 10);
        surface.text('nuestra página web en www.elpeluquero.ec', 125, 564, 10);
    }

    function canvasSurface(canvas) {
        const ctx = canvas.getContext('2d');
        canvas.width = WIDTH * 3;
        canvas.height = HEIGHT * 3;
        ctx.scale(3, 3);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        return {
            text(value, x, y, size, bold = false, color = '#141414', align = 'left') {
                ctx.font = `${bold ? 'bold' : 'normal'} ${size}px Arial, sans-serif`;
                ctx.fillStyle = color; ctx.textAlign = align;
                ctx.fillText(value, x, y);
            },
            rect(x, y, w, h, radius, stroke, fill, lineWidth = 1) {
                ctx.beginPath(); ctx.roundRect(x, y, w, h, radius);
                if (fill) { ctx.fillStyle = fill; ctx.fill(); }
                if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
            },
            line(x1, y1, x2, y2, color, width) {
                ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width;
                ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            },
            image(img, x, y, w, h) { ctx.drawImage(img, x, y, w, h); }
        };
    }

    function pdfSurface(doc) {
        const offset = 148.5 + (148.5 - WIDTH * MM) / 2;
        return {
            text(value, x, y, size, bold = false, color = '#141414', align = 'left') {
                setFont(doc, size, bold); doc.setTextColor(color);
                doc.text(value, offset + x * MM, y * MM, { align });
            },
            rect(x, y, w, h, radius, stroke, fill, lineWidth = 1) {
                if (stroke) doc.setDrawColor(stroke);
                if (fill) doc.setFillColor(fill);
                doc.setLineWidth(lineWidth * MM);
                doc.roundedRect(offset + x * MM, y * MM, w * MM, h * MM, radius * MM, radius * MM, fill ? (stroke ? 'FD' : 'F') : 'S');
            },
            line(x1, y1, x2, y2, color, width) {
                doc.setDrawColor(color); doc.setLineWidth(width * MM);
                doc.line(offset + x1 * MM, y1 * MM, offset + x2 * MM, y2 * MM);
            },
            image(img, x, y, w, h) { doc.addImage(img, 'PNG', offset + x * MM, y * MM, w * MM, h * MM); }
        };
    }

    function buildPdf(values, images) {
        const doc = newDocument();
        const layout = prepare(doc, values);
        if (Object.keys(layout.issues).length) throw new Error('Revisa los campos indicados antes de descargar.');
        doc.setProperties({ title: `Guía de envío - Orden ${clean(values.orderNumber)}`, author: 'Novepsa' });
        doc.setDrawColor(180, 180, 180); doc.setLineWidth(.2);
        doc.setLineDashPattern([2, 2], 0); doc.line(148.5, 0, 148.5, 210); doc.setLineDashPattern([], 0);
        drawGuide(pdfSurface(doc), layout, images);
        return doc;
    }

    function createState() {
        return { values: Object.fromEntries(fields.map((field) => [field.key, ''])), busy: false };
    }

    function markup(state) {
        return `<div id="shipping-workspace" class="shipping-workspace">
            <section class="shipping-form-card app-card" aria-labelledby="shipping-form-title">
                <h2 id="shipping-form-title" class="shipping-section-title">Datos del envío</h2>
                <p class="shipping-description">Los campos con * son obligatorios. La vista previa se actualiza al escribir y la letra se ajusta al espacio disponible.</p>
                <form id="shipping-form">
                    <div class="shipping-fields">${fields.map((field) => `<label class="shipping-field ${field.wide ? 'wide' : ''}" for="guide-${field.key}">
                        <span>${field.label}${field.required ? ' *' : ' <small>(opcional)</small>'}</span>
                        ${field.multiline
                            ? `<textarea id="guide-${field.key}" name="${field.key}" rows="2" maxlength="${field.max}" ${field.required ? 'required' : ''} ${field.autocomplete ? `autocomplete="${field.autocomplete}"` : ''} aria-describedby="guide-error-${field.key}">${escape(state.values[field.key])}</textarea>`
                            : `<input id="guide-${field.key}" name="${field.key}" type="${field.type || 'text'}" maxlength="${field.max}" value="${escape(state.values[field.key])}" ${field.required ? 'required' : ''} ${field.autocomplete ? `autocomplete="${field.autocomplete}"` : ''} placeholder="${field.placeholder || ''}" aria-describedby="guide-error-${field.key}">`}
                        <span id="guide-error-${field.key}" class="shipping-field-error" aria-live="polite"></span>
                    </label>`).join('')}</div>
                    <div class="shipping-actions">
                        <button id="shipping-download" class="shipping-button primary" type="submit" disabled><span class="material-icons" aria-hidden="true">download</span><span>Descargar PDF</span></button>
                        <button class="shipping-button" type="button" id="shipping-preview-button"><span class="material-icons" aria-hidden="true">visibility</span>Vista previa</button>
                        <button class="shipping-button" type="reset">Limpiar</button>
                    </div>
                </form>
                <p id="shipping-status" class="shipping-status" role="status">Cargando vista previa…</p>
                <button id="shipping-retry" class="shipping-button" type="button" hidden>Reintentar</button>
            </section>
            <section id="shipping-preview" class="shipping-preview-card app-card" aria-labelledby="shipping-preview-title" tabindex="-1">
                <div class="shipping-preview-heading"><h2 id="shipping-preview-title" class="shipping-section-title">Vista previa</h2><span class="shipping-badge">½ A4 · 148,5 × 210 mm</span></div>
                <div class="shipping-preview-stage"><canvas id="shipping-canvas" width="420" height="595" role="img" aria-label="Vista previa de la guía. Los datos corresponden a los campos del formulario."></canvas></div>
                <p class="shipping-preview-note">El PDF se descarga en una hoja A4 horizontal, con la guía en la mitad derecha y una línea de corte al centro. Imprime al 100 % o en tamaño real.</p>
                <a class="shipping-preview-link" href="#shipping-form-title">Volver a los datos <span class="material-icons" aria-hidden="true">arrow_upward</span></a>
            </section>
        </div>`;
    }

    async function mount(state) {
        const root = document.getElementById('shipping-workspace');
        const form = root.querySelector('form');
        const status = root.querySelector('#shipping-status');
        const download = root.querySelector('#shipping-download');
        const retry = root.querySelector('#shipping-retry');
        let images;
        let metrics;
        let frame;
        let submitted = false;
        const current = () => document.getElementById('shipping-workspace') === root;
        function message(value, error = false) { status.textContent = value; status.classList.toggle('error', error); }
        function update() {
            if (!images || !current()) return {};
            const layout = prepare(metrics, state.values);
            fields.forEach((field) => {
                const input = form.elements.namedItem(field.key);
                const error = layout.issues[field.key] || (submitted && field.required && !clean(input.value) ? 'Completa este campo.' : '');
                input.setCustomValidity(error);
                input.setAttribute('aria-invalid', String(Boolean(error)));
                root.querySelector(`#guide-error-${field.key}`).textContent = error;
            });
            drawGuide(canvasSurface(root.querySelector('canvas')), layout, images);
            const errors = Object.keys(layout.issues).length;
            if (!state.busy) message(errors ? 'Revisa los campos indicados para que todos los datos entren en la guía.' : 'Vista previa actualizada. Los datos se usan solo para generar esta guía.', Boolean(errors));
            return layout.issues;
        }
        form.addEventListener('input', (event) => {
            if (!fields.some((field) => field.key === event.target.name)) return;
            state.values[event.target.name] = event.target.value;
            event.target.setCustomValidity('');
            cancelAnimationFrame(frame); frame = requestAnimationFrame(update);
        });
        form.addEventListener('reset', (event) => {
            event.preventDefault();
            state.values = createState().values;
            submitted = false;
            fields.forEach((field) => { form.elements.namedItem(field.key).value = ''; });
            update(); form.elements.namedItem('orderNumber').focus();
        });
        root.querySelector('#shipping-preview-button').addEventListener('click', () => {
            update();
            const preview = root.querySelector('#shipping-preview');
            preview.focus({ preventScroll: true });
            preview.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
        });
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (state.busy || !images) return;
            submitted = true;
            update();
            if (!form.reportValidity()) return;
            state.busy = true; download.disabled = true;
            download.lastElementChild.textContent = 'Generando…';
            message('Preparando la descarga…');
            try {
                await new Promise((resolve) => setTimeout(resolve, 0));
                // Take a snapshot so edits cannot change the guide mid-download.
                const values = { ...state.values };
                const doc = buildPdf(values, images);
                const number = clean(values.orderNumber).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40) || 'manual';
                await doc.save(`Guia-Envio-${number}.pdf`, { returnPromise: true });
                if (current()) message('PDF generado. La descarga está lista en tu navegador.');
            } catch (error) {
                if (current()) message(error.message || 'No se pudo generar el PDF. Reintenta.', true);
            } finally {
                state.busy = false;
                // Resizing can remount the form while save() is in progress.
                const activeButton = document.getElementById('shipping-download');
                if (activeButton) { activeButton.disabled = false; activeButton.lastElementChild.textContent = 'Descargar PDF'; }
            }
        });
        async function initialize() {
            retry.hidden = true; download.disabled = true;
            message('Cargando vista previa…');
            try {
                metrics = newDocument(); images = await loadAssets();
                if (!current()) return;
                update(); download.disabled = state.busy;
            } catch (error) {
                if (current()) { message(error.message, true); retry.hidden = false; }
            }
        }
        retry.addEventListener('click', initialize);
        await initialize();
    }

    window.ShippingGuides = { createState, markup, mount };
})(window);
