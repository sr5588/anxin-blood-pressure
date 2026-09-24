import { CloudRepository } from '../server/cloud-repository';
import { createCode, hash } from '../server/service';
import { seedProducts } from '../server/catalog';
import { RedemptionCode } from '../shared/types';
// Run ONLY in a trusted server / authenticated CloudBase administrative runtime.
// No administrator path is exported by the public cloud function.
const cloud = require('wx-server-sdk');
const env = process.env.CLOUDBASE_ENV_ID;
if (!env) throw new Error('缺少CLOUDBASE_ENV_ID；请在可信管理环境执行');
cloud.init({ env });
const repo = new CloudRepository(cloud.database({ throwOnNotFound: false }));
async function run() {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'seed-products') {
    for (const p of seedProducts) {
      if (await repo.get('products', p.productId)) continue;
      await repo.set('products', p.productId, {
        ...p,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    console.log('商品配置已写入（已有商品保持不变）');
  } else if (cmd === 'cleanup-exports') {
    const files = await repo.list<{ fileID: string; expiresAt: number }>('export_files', {});
    let count = 0;
    for (const f of files.filter((f) => f.expiresAt <= Date.now())) {
      const r = await cloud.deleteFile({ fileList: [f.fileID] });
      if (
        r.fileList.some(
          (x: any) => x.status !== 0 && !/not exist|not found|不存在/i.test(x.errMsg || ''),
        )
      )
        throw new Error('文件删除失败，下次运行可重试');
      await repo.remove('export_files', hash(f.fileID));
      count++;
    }
    console.log('已清理到期快照：' + count);
  } else if (cmd === 'create-code') {
    const result = await createCode(repo, {
      days: arg === 'lifetime' ? null : Number(arg || 7),
      maxRedemptions: Number(process.env.MAX_REDEMPTIONS || 1),
      validDays: Number(process.env.VALID_DAYS || 30),
      campaignId: process.env.CAMPAIGN_ID || 'internal-free-trial',
      createdBy: process.env.ADMIN_ID || 'trusted-admin',
      boundUserId: process.env.BOUND_USER_ID,
    });
    console.log(JSON.stringify(result));
  } else if (cmd === 'disable-code') {
    const code = await repo.get<RedemptionCode>('redemption_codes', arg);
    if (!code) throw new Error('兑换码不存在');
    await repo.set('redemption_codes', arg, { ...code, status: 'disabled' });
    console.log('已禁用');
  } else if (cmd === 'inspect-code') {
    const code = await repo.get<RedemptionCode>('redemption_codes', arg);
    console.log(JSON.stringify(code));
    console.log(JSON.stringify(await repo.list('redemption_records', { codeId: arg })));
  } else
    throw new Error(
      '用法：admin.ts seed-products | create-code 7/30/90/365/lifetime | disable-code HASH | inspect-code HASH',
    );
}
run().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
