-- RLS expressions need EXECUTE on boolean/classification helpers.
grant execute on function private.can_manage_business(uuid,text) to authenticated;
grant execute on function private.import_capability(text) to authenticated;
