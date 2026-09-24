"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveReport = saveReport;
const pdf_1 = require("../shared/pdf");
async function saveReport(rows, range) {
    const data = (0, pdf_1.makeReport)(rows, range), path = wx.env.USER_DATA_PATH + '/安压日记医生报告.pdf';
    wx.getFileSystemManager().writeFileSync(path, data.buffer);
    await wx.openDocument({ filePath: path, fileType: 'pdf', showMenu: true });
}
