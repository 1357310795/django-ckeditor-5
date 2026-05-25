/**
 * VideoUpload — minimal CKEditor 5 plugin that adds a toolbar button to
 * upload a video file to the django-ckeditor-5 backend, then embeds the
 * resulting URL via the mediaEmbed plugin. The mediaEmbed extraProvider
 * registered in app.js recognizes local video URLs and emits a <video>
 * element with previewsInData enabled, so the saved HTML is a real
 * <video controls src="..."></video> tag.
 */

import { Plugin } from '@ckeditor/ckeditor5-core';
import { ButtonView } from '@ckeditor/ckeditor5-ui';

// Reuse the imageUpload icon shape but with a distinctive triangle play
// glyph baked in. Keeping it inline (no SVG file) avoids one more loader rule.
const VIDEO_ICON = `<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h11A1.5 1.5 0 0 1 17 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5v-11Zm1 0v11a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5h-11a.5.5 0 0 0-.5.5Z"/>
  <path d="M8.5 7.13a.5.5 0 0 1 .76-.43l4.5 2.87a.5.5 0 0 1 0 .85l-4.5 2.88a.5.5 0 0 1-.76-.43V7.13Z"/>
</svg>`;

export default class VideoUpload extends Plugin {
    static get pluginName() { return 'VideoUpload'; }

    init() {
        const editor = this.editor;
        const t = editor.t || (s => s);

        editor.ui.componentFactory.add('videoUpload', locale => {
            const view = new ButtonView(locale);
            view.set({
                label: t('Upload video'),
                icon: VIDEO_ICON,
                tooltip: true,
            });
            view.on('execute', () => this._openPicker());
            return view;
        });
    }

    _openPicker() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/mp4,video/webm,video/ogg,video/quicktime,video/x-m4v,video/*';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', () => {
            const file = input.files && input.files[0];
            input.remove();
            if (file) this._upload(file);
        });
        input.click();
    }

    async _upload(file) {
        const editor = this.editor;
        const cfg = editor.config.get('videoUpload') || {};
        const url = cfg.uploadUrl;
        if (!url) {
            console.error('VideoUpload: no uploadUrl configured');
            return;
        }
        const fd = new FormData();
        fd.append('upload', file);
        const headers = {};
        const simpleHeaders = editor.config.get('simpleUpload.headers') || {};
        if (simpleHeaders['X-CSRFToken']) {
            headers['X-CSRFToken'] = simpleHeaders['X-CSRFToken'];
        }
        try {
            const resp = await fetch(url, {
                method: 'POST',
                body: fd,
                headers,
                credentials: 'same-origin',
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok) {
                throw new Error(
                    (data && data.error && data.error.message) ||
                        `HTTP ${resp.status}`,
                );
            }
            if (!data.url) {
                throw new Error('Upload response missing url');
            }
            editor.execute('mediaEmbed', data.url);
        } catch (err) {
            console.error('VideoUpload failed:', err);
            try {
                const notif = editor.plugins.get('Notification');
                notif.showWarning(
                    `视频上传失败：${err.message || err}`,
                    { namespace: 'upload', title: '上传错误' },
                );
            } catch (_) {
                window.alert(`视频上传失败：${err.message || err}`);
            }
        }
    }
}
