import { describe, expect, it } from 'vitest'
import { assertTestDatabase } from './assert-test-database'

describe('assertTestDatabase', () => {
  it.each([
    'postgresql://postgres:postgres@localhost:5433/diet_gacha_test',
    'postgresql://postgres:postgres@localhost:5432/diet_gacha_test',
    'postgres://postgres:postgres@127.0.0.1:5433/diet_gacha_test',
  ])('専用のローカル DB を許可する: %s', (url) => {
    expect(() => assertTestDatabase(url)).not.toThrow()
  })

  it.each([
    '',
    'not-a-url',
    'postgresql://localhost/diet_gacha_test ',
    '\tpostgresql://localhost/diet_gacha_test',
    'postgresql://postgres:pass word@localhost/diet_gacha_test\n',
    '\u0001postgresql://localhost/diet_gacha_test',
    'postgresql://localhost:5433/production',
    'postgresql://localhost:5433/diet_gacha_test_backup',
    'postgresql://localhost:5433/production_diet_gacha_test',
    'postgresql://localhost.example.com/diet_gacha_test',
    'postgresql://127.0.0.1.example.com/diet_gacha_test',
    'postgresql://localhost:secret@production.example.com/diet_gacha_test',
    'postgresql://production.example.com/diet_gacha_test?host=localhost',
    'postgresql://localhost/diet_gacha_test?host=production.example.com',
    'postgresql://localhost/diet_gacha_test?dbname=production',
    'postgresql://localhost/diet_gacha_test#production',
    'https://localhost/diet_gacha_test',
  ])('専用 DB と確認できない URL は拒否する: %s', (url) => {
    expect(() => assertTestDatabase(url)).toThrow(
      'resetDb はローカルの diet_gacha_test 以外では実行しません',
    )
  })

  it('接続情報をエラーに含めない', () => {
    const url = 'postgresql://localhost:private-password@production.example.com/diet_gacha_test'
    expect(() => assertTestDatabase(url)).toThrow(
      /^resetDb はローカルの diet_gacha_test 以外では実行しません$/,
    )
  })
})
