from pathlib import Path
path = Path('test/admin-rename.test.js')
text = path.read_text(encoding='utf-8')
old = """  assert.equal((await request(`/api/admin/keys/${id}/revoke`, 'POST', admin)).status, 200);
  assert.equal((await request(route, 'POST', admin, { label: '취소상태' })).status, 404);"""
new = """  const revokedIssue = await request('/api/admin/keys', 'POST', admin, { label: '취소 검증' });
  assert.equal(revokedIssue.status, 201);
  const revokedId = revokedIssue.data.key.id;
  assert.equal((await request(`/api/admin/keys/${revokedId}/revoke`, 'POST', admin)).status, 200);
  assert.equal((await request(`/api/admin/keys/${revokedId}/rename`, 'POST', admin, { label: '취소상태' })).status, 404);"""
assert text.count(old) == 1
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Revoked-key behavior now tested on a separate identity without hitting valid per-key throttling.')
