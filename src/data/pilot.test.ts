import {
  createPilotParticipants,
  createPilotTeams,
  getPilotMetrics,
  pilotParticipants,
} from './pilot';

describe('pilot data', () => {
  it('creates a deterministic 1000 runner pilot base', () => {
    expect(pilotParticipants).toHaveLength(1000);
    expect(pilotParticipants[0]).toMatchObject({
      id: 'runner-0001',
      displayName: '匿名跑者 001',
    });
  });

  it('aggregates pilot metrics from anonymous participants', () => {
    const participants = createPilotParticipants(100, 8);
    const metrics = getPilotMetrics(participants);

    expect(metrics.totalParticipants).toBe(100);
    expect(metrics.totalDistanceKm).toBeGreaterThan(0);
    expect(metrics.activeRate).toBeGreaterThan(0);
    expect(metrics.shareCards).toBeGreaterThan(0);
  });

  it('aggregates teams without losing members', () => {
    const participants = createPilotParticipants(1000, 42);
    const teams = createPilotTeams(participants, 42);
    const members = teams.reduce((sum, team) => sum + team.members, 0);

    expect(teams).toHaveLength(42);
    expect(members).toBe(1000);
    expect(teams.some((team) => team.totalDistanceKm > 0)).toBe(true);
  });
});
