import { supabase, getUserId } from './supabase';

// ─── Session Sync ────────────────────────────────────────────────────

/**
 * Save or update a session in Supabase.
 * Called after each session completes or updates.
 */
export async function syncSession(sessionData) {
  if (!supabase) return;

  const userId = getUserId();

  try {
    // Check if session exists
    const { data: existing } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('categorie', sessionData.category)
      .eq('sous_categorie', sessionData.sub)
      .maybeSingle();

    const row = {
      user_id: userId,
      categorie: sessionData.category,
      sous_categorie: sessionData.sub,
      niveau: sessionData.difficulty || 'auto',
      nb_questions: sessionData.questionCount || 5,
      statut: sessionData.completed ? 'terminee' : 'en_cours',
      questions_ratees: sessionData.errors || [],
      questions_maitrisees: sessionData.mastered || [],
      nb_connaissances: sessionData.knowledgeCount || 0,
      jour: sessionData.day || 1,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase.from('sessions').update(row).eq('id', existing.id);
    } else {
      await supabase.from('sessions').insert(row);
    }
  } catch (err) {
    console.warn('Session sync error:', err.message);
  }
}

/**
 * Delete a session from Supabase.
 */
export async function deleteRemoteSession(category, sub) {
  if (!supabase) return;

  try {
    await supabase
      .from('sessions')
      .delete()
      .eq('user_id', getUserId())
      .eq('categorie', category)
      .eq('sous_categorie', sub);
  } catch (err) {
    console.warn('Session delete error:', err.message);
  }
}

// ─── Journal Sync ────────────────────────────────────────────────────

/**
 * Save daily journal entry to Supabase.
 */
export async function syncJournalEntry(date, entries) {
  if (!supabase) return;

  const userId = getUserId();

  try {
    // Upsert by user_id + date
    const { data: existing } = await supabase
      .from('journal')
      .select('id, resume')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle();

    const resume = {
      entries,
      totalLearned: entries.reduce((sum, e) => sum + (e.learned || 0), 0),
      sessionsCompleted: entries.filter((e) => e.type === 'session').length,
    };

    if (existing) {
      // Merge entries
      const merged = { ...existing.resume, ...resume };
      merged.entries = [...(existing.resume?.entries || []), ...entries];
      await supabase.from('journal').update({ resume: merged }).eq('id', existing.id);
    } else {
      await supabase.from('journal').insert({
        user_id: userId,
        date,
        resume,
      });
    }
  } catch (err) {
    console.warn('Journal sync error:', err.message);
  }
}

// ─── User Profile Sync ──────────────────────────────────────────────

/**
 * Save/update user profile stats in Supabase.
 */
export async function syncUserProfile(profileData) {
  if (!supabase) return;

  const userId = getUserId();

  try {
    const row = {
      id: userId,
      langue: profileData.lang || 'fr',
      nb_questions_defaut: profileData.defaultQuestionCount || 5,
      difficulte_defaut: profileData.defaultDifficulty || 'auto',
      streak: profileData.streak || 0,
      total_connaissances: profileData.totalKnowledge || 0,
      notifications_actives: profileData.notificationsEnabled ?? true,
      updated_at: new Date().toISOString(),
    };

    await supabase.from('users_profiles').upsert(row, { onConflict: 'id' });
  } catch (err) {
    console.warn('Profile sync error:', err.message);
  }
}

/**
 * Delete all user data from Supabase (reset).
 */
export async function deleteAllUserData() {
  if (!supabase) return;

  const userId = getUserId();

  try {
    await Promise.all([
      supabase.from('sessions').delete().eq('user_id', userId),
      supabase.from('journal').delete().eq('user_id', userId),
      supabase.from('users_profiles').delete().eq('id', userId),
    ]);
  } catch (err) {
    console.warn('Delete all data error:', err.message);
  }
}
