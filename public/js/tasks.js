// Data access layer for the `tasks` table. Row Level Security in
// supabase/schema.sql ensures each query only ever touches the current
// user's rows, but insert still needs user_id set explicitly to satisfy
// the policy's WITH CHECK clause.
window.TasksAPI = {
  async fetchAll() {
    const { data, error } = await window.sb
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async create({ title, description }) {
    const { data: userData, error: userError } = await window.sb.auth.getUser();
    if (userError) throw userError;

    const { data, error } = await window.sb
      .from("tasks")
      .insert({
        title,
        description: description || null,
        user_id: userData.user.id,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async setStatus(id, status) {
    const { data, error } = await window.sb
      .from("tasks")
      .update({ status })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    const { error } = await window.sb.from("tasks").delete().eq("id", id);
    if (error) throw error;
  },
};
