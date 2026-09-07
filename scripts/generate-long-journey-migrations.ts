import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { steadyFlame14, type LongJourneyManifest } from '../content/rhythms/steadyFlame14';
import { rooted21 } from '../content/rhythms/rooted21';
import { pilgrim40 } from '../content/rhythms/pilgrim40';

const migrations = new Map<string, LongJourneyManifest>([
  ['steady_flame_14', steadyFlame14],
  ['rooted_21', rooted21],
  ['pilgrim_40', pilgrim40],
]);

function literal(value: string | null) {
  return value === null ? 'null' : `'${value.replaceAll("'", "''")}'`;
}

function render(manifest: LongJourneyManifest) {
  const templateRows = Object.entries(manifest.localizations).map(([locale, copy]) =>
    `  (${literal(manifest.slug)}, ${literal(locale)}, ${literal(copy.title)}, ${literal(copy.subtitle)}, ${literal(copy.description)}, array[${literal(manifest.badge.tier)}], ${manifest.sessionCount}, true, true, 1)`,
  ).join(',\n');

  const blocks = manifest.sessions.flatMap((session) => session.steps);
  const blockRows = blocks.map((step) =>
    `  (${literal(step.blockId)}, ${literal(step.type)}, array[${literal(step.poolTag)}], true)`,
  ).join(',\n');
  const localizationRows = blocks.flatMap((step) => Object.entries(step.localizations).map(([locale, copy]) =>
    `    (${literal(step.blockId)}, ${literal(locale)}, ${literal(copy.title)}, ${literal(copy.body)}, ${literal(step.scriptureRef)}, ${literal(copy.cta)})`,
  )).join(',\n');
  const stepRows = manifest.sessions.flatMap((session) => session.steps.map((step, index) =>
    `    (${session.number}, ${index + 1}, ${literal(step.type)}, ${literal(step.poolTag)})`,
  )).join(',\n');

  const catalogTitle = manifest.localizations.en.title;
  const catalogDescription = manifest.localizations.en.description;

  return `-- Generated from api/content/rhythms/${manifest.slug}. Keep stable keys additive.\n\n` +
`insert into faith_harbor.journey_templates (\n  slug, language_code, title, subtitle, description, theme_tags, duration_days, is_premium, is_published, version\n) values\n${templateRows}\n` +
`on conflict (slug, language_code, version) do update set\n  title = excluded.title, subtitle = excluded.subtitle, description = excluded.description,\n  theme_tags = excluded.theme_tags, duration_days = excluded.duration_days,\n  is_premium = excluded.is_premium, is_published = excluded.is_published, updated_at = now();\n\n` +
`insert into faith_harbor.journey_blocks (slug, block_type, theme_tags, is_active) values\n${blockRows}\n` +
`on conflict (slug) do update set\n  block_type = excluded.block_type, theme_tags = excluded.theme_tags,\n  is_active = excluded.is_active, updated_at = now();\n\n` +
`insert into faith_harbor.journey_block_localizations (block_id, language_code, title, body, scripture_ref, cta_text)\nselect block.id, copy.language_code, copy.title, copy.body, copy.scripture_ref, copy.cta_text\nfrom faith_harbor.journey_blocks as block\njoin (values\n${localizationRows}\n) as copy(block_slug, language_code, title, body, scripture_ref, cta_text) on copy.block_slug = block.slug\n` +
`on conflict (block_id, language_code) do update set\n  title = excluded.title, body = excluded.body, scripture_ref = excluded.scripture_ref,\n  cta_text = excluded.cta_text, updated_at = now();\n\n` +
`insert into faith_harbor.journey_template_steps (template_id, day_number, step_order, step_type, block_pool_tag, required)\nselect template.id, step.day_number, step.step_order, step.step_type, step.block_pool_tag, true\nfrom faith_harbor.journey_templates as template\ncross join (values\n${stepRows}\n) as step(day_number, step_order, step_type, block_pool_tag)\nwhere template.slug = ${literal(manifest.slug)} and template.version = 1\n` +
`on conflict (template_id, day_number, step_order) do update set\n  step_type = excluded.step_type, block_pool_tag = excluded.block_pool_tag,\n  required = excluded.required, updated_at = now();\n\n` +
`insert into faith_harbor.gamification_milestones (\n  code, title, description, metric, target_value, badge_color, is_premium,\n  category, tier, theme_key, asset_key, display_priority, is_shareable, is_active\n) values (\n  ${literal(manifest.badge.code)}, ${literal(catalogTitle)}, ${literal(catalogDescription)},\n  'completed_journeys', ${manifest.badge.targetValue}, 'gold', true, 'journey',\n  ${literal(manifest.badge.tier)}, ${literal(manifest.slug)}, ${literal(manifest.badge.assetKey)},\n  ${manifest.badge.targetValue}, true, true\n) on conflict (code) do update set\n  title = excluded.title, description = excluded.description, metric = excluded.metric,\n  target_value = excluded.target_value, badge_color = excluded.badge_color,\n  is_premium = excluded.is_premium, category = excluded.category, tier = excluded.tier,\n  theme_key = excluded.theme_key, asset_key = excluded.asset_key,\n  display_priority = excluded.display_priority, is_shareable = excluded.is_shareable,\n  is_active = excluded.is_active;\n\n` +
`create table if not exists faith_harbor.journey_milestone_rewards (\n  template_slug text primary key,\n  milestone_code text not null references faith_harbor.gamification_milestones(code) on delete restrict\n);\n\nalter table faith_harbor.journey_milestone_rewards enable row level security;\nrevoke all on table faith_harbor.journey_milestone_rewards from public, anon, authenticated;\ngrant select on table faith_harbor.journey_milestone_rewards to service_role;\n\n` +
`insert into faith_harbor.journey_milestone_rewards (template_slug, milestone_code)\nvalues (${literal(manifest.slug)}, ${literal(manifest.badge.code)})\non conflict (template_slug) do update set milestone_code = excluded.milestone_code;\n\n` +
`create or replace function faith_harbor.award_completed_journey_milestone()\nreturns trigger\nlanguage plpgsql\nsecurity definer\nset search_path = ''\nas $$\ndeclare\n  v_milestone_code text;\nbegin\n  if new.status = 'completed' and old.status is distinct from 'completed' and new.user_id is not null then\n    select reward.milestone_code into v_milestone_code\n    from faith_harbor.journey_templates as template\n    join faith_harbor.journey_milestone_rewards as reward on reward.template_slug = template.slug\n    where template.id = new.template_id;\n\n    if v_milestone_code is not null then\n      insert into faith_harbor.user_milestones (user_id, anonymous_profile_id, milestone_code, metadata)\n      values (new.user_id, null, v_milestone_code, pg_catalog.jsonb_build_object('duration_days', new.total_completed_days))\n      on conflict do nothing;\n    end if;\n  end if;\n  return new;\nend;\n$$;\n\nrevoke all on function faith_harbor.award_completed_journey_milestone() from public, anon, authenticated, service_role;\n\ndo $$\nbegin\n  if not exists (\n    select 1 from pg_catalog.pg_trigger\n    where tgname = 'award_completed_journey_milestone'\n      and tgrelid = 'faith_harbor.user_journeys'::regclass\n      and not tgisinternal\n  ) then\n    create trigger award_completed_journey_milestone\n    after update of status on faith_harbor.user_journeys\n    for each row execute function faith_harbor.award_completed_journey_milestone();\n  end if;\nend;\n$$;\n`;
}

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../supabase/migrations');
for (const [slug, manifest] of migrations) {
  const matches = fs.readdirSync(directory).filter((name) => name.endsWith(`_${slug}.sql`));
  if (matches.length !== 1) throw new Error(`Expected exactly one migration for ${slug}`);
  fs.writeFileSync(path.join(directory, matches[0]!), render(manifest));
}
