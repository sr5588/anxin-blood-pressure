import { HealthService, ApiError, hash } from './service';
import { CloudRepository } from './cloud-repository';
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const repo = new CloudRepository(cloud.database({ throwOnNotFound: false }));
// Mock can only run in an explicitly isolated development environment AND for
// an allowlisted account. Production defaults to deny, regardless of client flags.
export async function main(event: any) {
  const ctx = cloud.getWXContext();
  const userId = ctx.OPENID;
  if (!userId) return { ok: false, code: 'UNAUTHENTICATED', message: '请从微信小程序访问' };
  const allowMockPayment =
    process.env.DEPLOYMENT_STAGE === 'development' &&
    process.env.ENABLE_MOCK_PAYMENT === 'true' &&
    (process.env.MOCK_USER_ALLOWLIST || '').split(',').includes(userId);
  const deleteFiles = async (ids: string[]) => {
    const result = await cloud.deleteFile({ fileList: ids });
    if (
      result.fileList?.some(
        (f: any) => f.status !== 0 && !/not exist|not found|不存在/i.test(f.errMsg || ''),
      )
    )
      throw new Error('云端文件删除未完成');
  };
  const api = new HealthService(repo, { allowMockPayment, deleteFiles });
  try {
    let data: unknown;
    switch (event.action) {
      case 'bootstrap':
        data = await api.bootstrap(userId);
        break;
      case 'history':
        data = await api.history(userId, event.range, event.period);
        break;
      case 'sync':
        data = await api.sync(userId, event.session, event.epoch);
        break;
      case 'restore':
      case 'export': {
        const account = await api.account(userId);
        const rows = await api.exportAll(userId);
        const bytes = Buffer.from(JSON.stringify(rows));
        // Private storage avoids cloud-function response limits for complete exports.
        const uploaded = await cloud.uploadFile({
          cloudPath: `exports/${hash(userId)}/${Date.now()}-${require('node:crypto').randomUUID()}.json`,
          fileContent: bytes,
        });
        try {
          await api.registerExport(userId, uploaded.fileID, account.syncEpoch);
        } catch (e) {
          await deleteFiles([uploaded.fileID]);
          throw e;
        }
        const signed = await cloud.getTempFileURL({
          fileList: [{ fileID: uploaded.fileID, maxAge: 300 }],
        });
        data = { fileID: uploaded.fileID, url: signed.fileList[0].tempFileURL, temporary: true };
        break;
      }
      case 'cleanupExport': {
        if (typeof event.fileID !== 'string') throw new ApiError('INVALID', '文件标识无效');
        const file = await repo.get<{ userId: string }>('export_files', hash(event.fileID));
        if (!file || file.userId !== userId) throw new ApiError('FORBIDDEN', '文件不属于此账号');
        await deleteFiles([event.fileID]);
        await repo.remove('export_files', hash(event.fileID));
        data = { ok: true };
        break;
      }
      case 'deleteSession':
        data = await api.deleteSession(userId, event.sessionId);
        break;
      case 'deleteAll':
        data = await api.deleteAll(userId);
        break;
      case 'startTrial':
        data = await api.startTrial(userId);
        break;
      case 'createWechatOrder':
      case 'verifyWechatOrder':
        throw new ApiError('PAYMENT_NOT_CONFIGURED', '官方虚拟支付配置及验单服务尚未接入');
      case 'createOrder':
        data = await api.createOrder(userId, event.productId, event.requestId);
        break;
      case 'confirmMockPayment':
        data = await api.confirmMockPayment(userId, event.orderId);
        break;
      case 'refundMock':
        data = await api.refundMock(userId, event.orderId);
        break;
      case 'redeem':
        if (typeof event.code !== 'string' || event.code.length > 64)
          throw new ApiError('INVALID_CODE', '兑换码无效');
        data = await api.redeem(userId, event.code);
        break;
      default:
        throw new ApiError('UNKNOWN_ACTION', '不支持的操作');
    }
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, code: e.code, message: e.message };
    console.error('api_error', {
      action: event.action,
      name: e instanceof Error ? e.name : 'unknown',
    });
    return {
      ok: false,
      code: 'SERVICE_ERROR',
      message:
        event.action === 'sync' && e instanceof Error ? e.message : '服务暂时不可用，请稍后重试',
    };
  }
}
