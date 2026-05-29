-- ============================================
-- knowledge_base 数据备份
-- 导出时间：2026-05-17
-- 数据条数：11条
-- 来源：Supabase 项目 thgcjxnvsantzrdyqcug
-- 使用方法：在Supabase SQL Editor中执行即可恢复
-- ============================================

-- 先清空旧数据（谨慎使用，确认无误后取消注释）
-- DELETE FROM knowledge_base;

INSERT INTO knowledge_base (id, title, content, category, is_displayed, display_order, created_at, updated_at) VALUES (1, 'BMI（体质指数）', E'BMI = 体重(kg) ÷ 身高(m)²。用于评估体重是否在健康范围。\n\n中国标准：\n- < 18.5：偏瘦\n- 18.5 ~ 23.9：正常\n- 24 ~ 27.9：超重\n- ≥ 28：肥胖', '名词解释', t, 1, '2026-05-04 09:24:04.433043+00', '2026-05-04 09:24:04.433043+00');

INSERT INTO knowledge_base (id, title, content, category, is_displayed, display_order, created_at, updated_at) VALUES (2, 'BMR（基础代谢率）', E'基础代谢率是指人体在清醒且极端安静状态下，维持生命所需的最低能量。\n\n计算公式（Mifflin-St Jeor）：\n男：BMR = 10×体重(kg) + 6.25×身高(cm) - 5×年龄 + 5\n女：BMR = 10×体重(kg) + 6.25×身高(cm) - 5×年龄 - 161', '计算公式', t, 2, '2026-05-04 09:24:04.433043+00', '2026-05-04 09:24:04.433043+00');

INSERT INTO knowledge_base (id, title, content, category, is_displayed, display_order, created_at, updated_at) VALUES (3, '每天摄入总能量', E'每天应该吃多少热量，由标准体重、能量系数、年龄系数共同决定。\n\n计算公式：每天摄入总能量 = 标准体重 × 能量系数 × 年龄系数\n\n标准体重 = 身高(cm) - 105\n\n能量系数：根据体力活动确定\n- 卧床：25 kcal/kg/天\n- 轻体力（坐办公室）：30 kcal/kg/天\n- 中体力（走动较多）：35 kcal/kg/天\n- 重体力（体力劳动）：40 kcal/kg/天\n\n年龄系数：根据年龄确定\n- 50岁以下：1.0\n- 50-59岁：0.9\n- 60-69岁：0.8\n- 70-79岁：0.7\n- 80岁以上：0.6\n\n特殊规则：当BMI ≥ 28时，用调节体重替代标准体重\n调节体重 = (真实体重 + 标准体重) ÷ 2', '计算公式', t, 3, '2026-05-04 09:24:04.433043+00', '2026-05-07 16:09:24.131426+00');

INSERT INTO knowledge_base (id, title, content, category, is_displayed, display_order, created_at, updated_at) VALUES (4, '什么是低碳水饮食', E'低碳水饮食（Low-Carb Diet）是一种减少碳水化合物摄入、增加脂肪和适量蛋白质的饮食方式。\n\n核心原理：减少碳水摄入 → 降低胰岛素水平 → 促进脂肪分解供能。\n\n注意：不是零碳水，而是控制质量和数量。优先选择粗粮、蔬菜中的优质碳水。', '名词解释', t, 4, '2026-05-04 09:24:04.433043+00', '2026-05-04 09:24:04.433043+00');

INSERT INTO knowledge_base (id, title, content, category, is_displayed, display_order, created_at, updated_at) VALUES (5, '三大营养素能量换算', E'1克蛋白质 = 4 kcal\n1克碳水化合物 = 4 kcal\n1克脂肪 = 9 kcal\n\n每天的总热量摄入由这三类营养素提供，比例不同决定了饮食的性质。', '计算公式', t, 5, '2026-05-04 09:24:04.433043+00', '2026-05-04 09:24:04.433043+00');

INSERT INTO knowledge_base (id, title, content, category, is_displayed, display_order, created_at, updated_at) VALUES (6, '蛋白质的作用', E'蛋白质是人体的"建材"——构成肌肉、皮肤、毛发、酶和激素。\n\n低碳水饮食期间，蛋白质摄入要充足，防止肌肉流失。\n\n推荐来源：鸡胸肉、鱼虾、鸡蛋、豆腐、瘦肉。', '名词解释', f, 6, '2026-05-04 09:24:04.433043+00', '2026-05-04 09:24:04.433043+00');

INSERT INTO knowledge_base (id, title, content, category, is_displayed, display_order, created_at, updated_at) VALUES (7, '脂肪的作用与误区', E'脂肪不是坏东西！它是人体的重要能量储备，也是细胞膜的重要组成部分。\n\n低碳水饮食中脂肪是主要能量来源。\n\n推荐来源：橄榄油、牛油果、坚果、深海鱼。\n\n⚠️ 注意：要避免反式脂肪酸（氢化植物油）。', '名词解释', f, 7, '2026-05-04 09:24:04.433043+00', '2026-05-04 09:24:04.433043+00');

INSERT INTO knowledge_base (id, title, content, category, is_displayed, display_order, created_at, updated_at) VALUES (8, '生酮饮食的注意事项', E'生酮饮食（Ketogenic Diet）是极低碳水（5%）、高脂肪（70%）、适量蛋白质（25%）的饮食方式。\n\n⚠️ 需在专业指导下进行，不适合：\n- 糖尿病患者\n- 肝胆疾病患者\n- 孕妇和哺乳期\n- 60岁以上老年人\n\n初期可能出现"生酮流感"（头晕、乏力），通常1-2周消失。', '名词解释', f, 8, '2026-05-04 09:24:04.433043+00', '2026-05-04 09:24:04.433043+00');

INSERT INTO knowledge_base (id, title, content, category, is_displayed, display_order, created_at, updated_at) VALUES (20, '食物的7大类营养素', E'食物分为7大类营养素——\n\n最主要三大类（供能营养素）：\n① 碳水化合物：主要能量来源，1g提供4kcal\n② 蛋白质：构成身体组织，1g提供4kcal\n③ 脂类：高效储能，1g提供9kcal\n\n次要4大类（不提供能量但不可或缺）：\n④ 维生素：调节代谢，维持生理功能\n⑤ 矿物质：构成骨骼、维持电解质平衡\n⑥ 膳食纤维：促进肠道健康，调节血糖\n⑦ 水：构成体液，参与所有生化反应', '名词解释', t, 0, '2026-05-08 15:51:58.922676+00', '2026-05-08 15:51:58.922676+00');

INSERT INTO knowledge_base (id, title, content, category, is_displayed, display_order, created_at, updated_at) VALUES (21, '食物动力效应', E'消化食物也要消耗能量，这就是"食物动力效应"。\n三大营养素的动力效应差异很大：\n• 蛋白质：消耗30%（吃进去100kcal，身体只吸收70kcal）\n• 碳水化合物：消耗5%（吃进去100kcal，身体吸收95kcal）\n• 脂肪：消耗5%（吃进去100kcal，身体吸收95kcal）\n这意味着：高蛋白饮食的实际热量摄入会明显低于计算值，是低碳水饮食减脂效果好的一大原因。', '计算公式', t, 10, '2026-05-08 16:05:14.771828+00', '2026-05-08 16:29:10.598172+00');

INSERT INTO knowledge_base (id, title, content, category, is_displayed, display_order, created_at, updated_at) VALUES (22, '三大营养素推荐比例（夏萌实操标准）', E'【来源】中国居民膳食指南2022 + 实操调整\n\n食物分为7大类营养素：\n• 最主要三大类：碳水化合物、蛋白质、脂类\n• 次要四大类：维生素、矿物质、膳食纤维、水\n\n---\n三大营养素能量比例范围：\n• 蛋白质：10%～15%（膳食指南2022：10%～20%，夏萌实操取上限15%）\n• 脂类：20%～30%\n• 碳水化合物：55%～65%（膳食指南2022：50%～65%，实操取下限55%）\n\n---\n实操取值原则（夏萌标准）：\n• 碳水化合物取最低值：55%\n• 蛋白质取最高值：15%\n• 脂类取：30%\n\n---\n特殊人群调整：\n• 脑病患者：脂类比例需远超30%，取40%\n• 糖尿病患者：碳水化合物比例降至40%～55%\n\n---\n举例（正常男士每日2100kcal）：\n• 碳水化合物：2100×55% = 1155kcal → 1155÷4 = 288.75g\n• 蛋白质：2100×15% = 315kcal → 315÷4 = 78.75g\n• 脂类：2100×30% = 630kcal → 630÷9 = 70g\n  （植物油、动物油各占一半；动物油可通过鸡蛋、牛奶、肉类、坚果获得）', '计算公式', t, 11, '2026-05-09 15:36:14.194575+00', '2026-05-09 16:10:58.126098+00');
