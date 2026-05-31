-- 清理测试数据（保留测试账号本身）
-- 在 Supabase SQL Editor 执行

DELETE FROM energy_compensations WHERE user_id IN (SELECT id FROM user_accounts WHERE username IN ('test001@163.com', 'test002@163.com', 'test003@163.com'));
DELETE FROM checkin_logs WHERE user_id IN (SELECT id FROM user_accounts WHERE username IN ('test001@163.com', 'test002@163.com', 'test003@163.com'));
DELETE FROM meal_plans WHERE user_id IN (SELECT id FROM user_accounts WHERE username IN ('test001@163.com', 'test002@163.com', 'test003@163.com'));
DELETE FROM survey_results WHERE user_id IN (SELECT id FROM user_accounts WHERE username IN ('test001@163.com', 'test002@163.com', 'test003@163.com'));
DELETE FROM user_settings WHERE user_id IN (SELECT id FROM user_accounts WHERE username IN ('test001@163.com', 'test002@163.com', 'test003@163.com'));
