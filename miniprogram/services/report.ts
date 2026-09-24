import { Session } from '../../shared/types';
import { makeReport } from '../../shared/pdf';
export async function saveReport(rows: Session[], range: string) {
  const data = makeReport(rows, range),
    path = wx.env.USER_DATA_PATH + '/安压日记医生报告.pdf';
  wx.getFileSystemManager().writeFileSync(path, data.buffer as ArrayBuffer);
  await wx.openDocument({ filePath: path, fileType: 'pdf', showMenu: true });
}
