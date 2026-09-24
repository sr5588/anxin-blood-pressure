"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeReport = makeReport;
const config_1 = require("./config");
const pdf_font_1 = require("./pdf-font");
const domain_1 = require("./domain");
// Dependency-free PDF with embedded OFL Chinese font. All text is glyph-ID hex,
// so no patient-provided string can inject PDF operators.
function makeReport(sessions, rangeLabel, now = Date.now()) {
    const all = sessions.filter((s) => !s.deletedAt).sort((a, b) => a.measuredAt - b.measuredAt);
    const raw = all.flatMap((s) => s.readings.map((r, i) => ({ s, r, i })));
    const pageCount = Math.max(1, Math.ceil(raw.length / 16)), objects = [];
    const add = (s) => {
        objects.push(s);
        return objects.length;
    };
    const catalog = add(''), pages = add('');
    const font = add('<< /Type /Font /Subtype /Type0 /BaseFont /ANXINN+NotoSansSC /Encoding /Identity-H /DescendantFonts [4 0 R] /ToUnicode 7 0 R >>');
    const entries = Object.entries(pdf_font_1.glyphs), widths = entries.map(([, v]) => `${v[0]} [${v[1]}]`).join(' ');
    add(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /ANXINN+NotoSansSC /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /DW 1000 /W [${widths}] /FontDescriptor 5 0 R /CIDToGIDMap /Identity >>`);
    add('<< /Type /FontDescriptor /FontName /ANXINN+NotoSansSC /Flags 4 /FontBBox [-1000 -1000 3000 3000] /ItalicAngle 0 /Ascent 1160 /Descent -288 /CapHeight 733 /StemV 80 /FontFile2 6 0 R >>');
    add(`<< /Length ${pdf_font_1.fontHex.length + 1} /Length1 ${pdf_font_1.fontHex.length / 2} /Filter /ASCIIHexDecode >>\nstream\n${pdf_font_1.fontHex}>\nendstream`);
    let cmap = '/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /AnxinUCS def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange\n';
    for (let i = 0; i < entries.length; i += 100) {
        const chunk = entries.slice(i, i + 100);
        cmap +=
            `${chunk.length} beginbfchar\n` +
                chunk
                    .map(([u, v]) => `<${v[0].toString(16).padStart(4, '0')}> <${Number(u).toString(16).padStart(4, '0')}>`)
                    .join('\n') +
                '\nendbfchar\n';
    }
    cmap += 'endcmap CMapName currentdict /CMap defineresource pop end end';
    add(`<< /Length ${cmap.length} >>\nstream\n${cmap}\nendstream`);
    const refs = [];
    const hex = (s) => Array.from(s)
        .map((c) => (pdf_font_1.glyphs[String(c.charCodeAt(0))]?.[0] || 0).toString(16).padStart(4, '0'))
        .join('');
    for (let page = 0; page < pageCount; page++) {
        let ops = '';
        const text = (s, x, y, size = 11, color = '0.18 0.25 0.34') => {
            ops += `${color} rg BT /F1 ${size} Tf 1 0 0 1 ${x} ${842 - y} Tm <${hex(s)}> Tj ET\n`;
        };
        ops += '0.965 0.977 0.99 rg 0 686 595 156 re f\n';
        text('安压日记 | 家庭血压记录', 40, 55, 24);
        text(rangeLabel + '医生回顾报告', 40, 86, 14, '0.25 0.42 0.63');
        text('生成日期：' + (0, domain_1.dateKey)(now) + '   时区：北京时间', 40, 111, 10);
        text(`共 ${all.length} 组测量，${raw.length} 次原始读数`, 40, 140, 11);
        if (all.length) {
            const s = Math.round(all.reduce((n, r) => n + r.average.systolic, 0) / all.length), d = Math.round(all.reduce((n, r) => n + r.average.diastolic, 0) / all.length);
            text(`组均值的平均：${s} / ${d} mmHg`, 40, 186, 16);
        }
        else
            text('所选范围内暂无记录', 40, 186, 16);
        text('单次读数不能用于诊断，请勿根据本报告自行调整用药。', 40, 213, 10);
        text(`${config_1.MedicalConfig.homeBpThreshold.systolic} / ${config_1.MedicalConfig.homeBpThreshold.diastolic} mmHg 为家庭平均血压参考界值，不是单次诊断结论。`, 40, 234, 10);
        text('测量时间', 40, 276);
        text('组内序号', 191, 276);
        text('收缩压', 273, 276);
        text('舒张压', 350, 276);
        text('脉搏', 430, 276);
        text('复测状态', 490, 276);
        raw.slice(page * 16, (page + 1) * 16).forEach(({ s, r, i }, row) => {
            const y = 304 + row * 25;
            if (row % 2 === 0)
                ops += `0.97 0.98 0.99 rg 35 ${842 - y - 7} 525 25 re f\n`;
            text((0, domain_1.dateKey)(r.measuredAt) + ' ' + (0, domain_1.timeText)(r.measuredAt), 40, y, 9);
            text(String(i + 1) + ' / ' + s.readings.length, 205, y, 10);
            text(String(r.systolic), 287, y, 11);
            text(String(r.diastolic), 365, y, 11);
            text(String(r.pulse), 439, y, 11);
            text(s.status === 'complete' ? '已完成' : '未完成', 490, y, 10);
        });
        text('单位：血压 mmHg；脉搏 次/分。未完成复测组也计入组平均。', 40, 741, 9);
        text('医学依据：中国高血压防治指南（2024年修订版）。', 40, 760, 9);
        text('本报告由用户记录生成，仅辅助回顾，不替代医生诊疗。', 40, 779, 9);
        text(`${page + 1} / ${pageCount}`, 510, 806, 10);
        const stream = add(`<< /Length ${ops.length} >>\nstream\n${ops}endstream`);
        refs.push(add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${stream} 0 R >>`));
    }
    objects[catalog - 1] = `<< /Type /Catalog /Pages ${pages} 0 R >>`;
    objects[pages - 1] =
        `<< /Type /Pages /Count ${pageCount} /Kids [${refs.map((n) => n + ' 0 R').join(' ')}] >>`;
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((s, i) => {
        offsets.push(pdf.length);
        pdf += `${i + 1} 0 obj\n${s}\nendobj\n`;
    });
    const xref = pdf.length;
    pdf +=
        `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
            offsets
                .slice(1)
                .map((n) => String(n).padStart(10, '0') + ' 00000 n \n')
                .join('') +
            `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Uint8Array.from(pdf, (c) => c.charCodeAt(0));
}
