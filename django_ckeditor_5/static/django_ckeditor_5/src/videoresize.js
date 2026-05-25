/**
 * VideoResize — add drag-to-resize handles to local-video mediaEmbed widgets.
 *
 * Mirrors what ImageResize does for images: extends the mediaEmbed model
 * element with a width attribute, sets up two-way conversion between that
 * attribute and the figure's inline style, and attaches CKEditor 5's
 * WidgetResize utility to the widget so the user can drag corners to resize.
 *
 * Only video URLs trigger the resizer — non-video mediaEmbed providers
 * (YouTube, Vimeo, etc.) keep their default static sizing.
 */

import { Plugin } from '@ckeditor/ckeditor5-core';
import { WidgetResize } from '@ckeditor/ckeditor5-widget';

const VIDEO_URL_RE = /^https?:\/\/.*\.(?:mp4|webm|ogv|mov|m4v)(?:\?.*)?$/i;

export default class VideoResize extends Plugin {
    static get pluginName() { return 'VideoResize'; }
    static get requires() { return [WidgetResize]; }

    init() {
        const editor = this.editor;
        const schema = editor.model.schema;
        const conversion = editor.conversion;

        if (!schema.isRegistered('media')) {
            return;
        }
        schema.extend('media', { allowAttributes: ['mediaWidth'] });

        // Downcast: model 'mediaWidth' -> style="width:X" on the <figure>.
        // We use a custom dispatcher rather than attributeToAttribute because
        // the mediaEmbed widget uses a raw-element rendering and we want the
        // style applied to the outer <figure> (the widget container) only.
        conversion.for('downcast').add(dispatcher => {
            dispatcher.on('attribute:mediaWidth:media', (evt, data, conversionApi) => {
                if (!conversionApi.consumable.consume(data.item, evt.name)) {
                    return;
                }
                const writer = conversionApi.writer;
                const figure = conversionApi.mapper.toViewElement(data.item);
                if (!figure) return;
                if (data.attributeNewValue) {
                    writer.setStyle('width', data.attributeNewValue, figure);
                } else {
                    writer.removeStyle('width', figure);
                }
            });
        });

        // Upcast: <figure class="media" style="width:X%"> -> mediaWidth.
        conversion.for('upcast').attributeToAttribute({
            view: {
                name: 'figure',
                styles: { width: /.+/ },
            },
            model: {
                key: 'mediaWidth',
                value: viewElement => viewElement.getStyle('width'),
            },
        });

        // Attach a resizer to every freshly-rendered video media widget.
        // Fires on both first data load and live insertion.
        editor.editing.downcastDispatcher.on('insert:media', (evt, data, conversionApi) => {
            const modelElement = data.item;
            const url = modelElement.getAttribute('url') || '';
            if (!VIDEO_URL_RE.test(url)) return;

            const widget = conversionApi.mapper.toViewElement(modelElement);
            if (!widget) return;

            editor.plugins.get(WidgetResize).attachTo({
                unit: '%',
                modelElement,
                viewElement: widget,
                editor,
                getHandleHost(domWidgetElement) {
                    return domWidgetElement.querySelector('video') || domWidgetElement;
                },
                getResizeHost(domWidgetElement) {
                    return domWidgetElement;
                },
                onCommit(newValue) {
                    editor.model.change(writer => {
                        writer.setAttribute('mediaWidth', newValue, modelElement);
                    });
                },
            });
        }, { priority: 'low' });
    }
}
