import {
  communityParticipants,
  createCommunityParticipants,
  createCommunityTeams,
  getCommunityMetrics,
} from './community';

describe('community data', () => {
  it('creates a deterministic community sample base', () => {
    expect(communityParticipants).toHaveLength(1000);
    expect(communityParticipants[0]).toMatchObject({
      id: 'runner-0001',
      displayName: '连云港跑友 001',
    });
  });

  it('aggregates community metrics from sample participants', () => {
    const participants = createCommunityParticipants(100, 8);
    const metrics = getCommunityMetrics(participants);

    expect(metrics.totalParticipants).toBe(100);
    expect(metrics.totalDistanceKm).toBeGreaterThan(0);
    expect(metrics.activeRate).toBeGreaterThan(0);
    expect(metrics.shareCards).toBeGreaterThan(0);
  });

  it('aggregates teams without losing members', () => {
    const participants = createCommunityParticipants(1000, 42);
    const teams = createCommunityTeams(participants, 42);
    const members = teams.reduce((sum, team) => sum + team.members, 0);

    expect(teams).toHaveLength(42);
    expect(members).toBe(1000);
    expect(teams.some((team) => team.totalDistanceKm > 0)).toBe(true);
  });
});
