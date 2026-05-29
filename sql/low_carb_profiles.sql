-- 建表：低碳水饮食的三个档位
CREATE TABLE IF NOT EXISTS "低碳水饮食的三个档位" (
  "方案名称" TEXT PRIMARY KEY,
  "碳水下限" NUMERIC(5,2) NOT NULL,
  "碳水上限" NUMERIC(5,2) NOT NULL,
  "碳水默认" NUMERIC(5,2) NOT NULL,
  "蛋白质比例" NUMERIC(5,2) NOT NULL,
  "脂肪比例" NUMERIC(5,2) NOT NULL,
  "动物脂肪占比" NUMERIC(5,2) NOT NULL,
  "植物脂肪占比" NUMERIC(5,2) NOT NULL,
  "调整频率" TEXT NOT NULL,
  "说明" TEXT
);

-- 插入三条数据
INSERT INTO "低碳水饮食的三个档位"
  ("方案名称", "碳水下限", "碳水上限", "碳水默认", "蛋白质比例", "脂肪比例", "动物脂肪占比", "植物脂肪占比", "调整频率", "说明")
VALUES
  ('控制型低碳水饮食', 25, 44, 35, 15, 50, 50, 50, '2周', '不分解脂肪'),
  ('温和型低碳水饮食', 10, 25, 20, 15, 65, 50, 50, '2周', '间断分解脂肪，并产生酮体'),
  ('极低碳水饮食/生酮饮食', 5, 10, 10, 20, 70, 50, 50, '2周', '产生酮体')
ON CONFLICT ("方案名称") DO UPDATE SET
  "碳水下限" = EXCLUDED."碳水下限",
  "碳水上限" = EXCLUDED."碳水上限",
  "碳水默认" = EXCLUDED."碳水默认",
  "蛋白质比例" = EXCLUDED."蛋白质比例",
  "脂肪比例" = EXCLUDED."脂肪比例",
  "动物脂肪占比" = EXCLUDED."动物脂肪占比",
  "植物脂肪占比" = EXCLUDED."植物脂肪占比",
  "调整频率" = EXCLUDED."调整频率",
  "说明" = EXCLUDED."说明";
