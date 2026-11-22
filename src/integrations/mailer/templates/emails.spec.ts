import { resetPasswordEmail, vivaMarkingEmail, vivaResultsEmail } from './emails';

describe('email templates', () => {
  const resetUrl = 'https://aiexaminer.app/auth/reset-password?token=abc&x=1';

  it('puts the reset link in the button, the fallback and the text version', () => {
    const email = resetPasswordEmail({ firstName: 'Ada', resetUrl });
    expect(email.subject).toBe('Reset your AI Examiner password');
    expect(email.html).toContain('href="https://aiexaminer.app/auth/reset-password?token=abc&amp;x=1"');
    expect(email.html).toContain('Hi Ada,');
    expect(email.text).toContain(`Reset password: ${resetUrl}`);
    expect(email.text).toContain('expires in 10 minutes');
  });

  it('escapes names so they cannot inject HTML', () => {
    const email = resetPasswordEmail({ firstName: '<b>Eve</b>', resetUrl });
    expect(email.html).toContain('Hi &lt;b&gt;Eve&lt;/b&gt;,');
    expect(email.html).not.toContain('<b>Eve</b>');
  });

  it('greets without a name when there is none', () => {
    expect(resetPasswordEmail({ firstName: '  ', resetUrl }).text).toContain('Hi there,');
    expect(vivaMarkingEmail({}).text).toContain('Hi there,');
  });

  it('names the document in the viva emails when it is known', () => {
    expect(vivaMarkingEmail({ firstName: 'Ada', documentTitle: 'Renal Notes' }).text).toContain(
      'oral viva on Renal Notes.',
    );
    expect(vivaMarkingEmail({ firstName: 'Ada' }).text).toContain('Thanks for taking your oral viva. ');
  });

  it('shows the viva results link and the date taken', () => {
    const email = vivaResultsEmail({
      firstName: 'Ada',
      documentTitle: 'Renal Notes',
      takenOn: new Date('2026-11-22T12:00:00Z'),
      resultsUrl: 'https://aiexaminer.app/questions/practise-questions/oral-(viva)/q1',
    });
    expect(email.subject).toBe('Your viva results are ready');
    expect(email.html).toContain('Oral viva · 22 November 2026');
    expect(email.text).toContain('View my results: https://aiexaminer.app/questions/practise-questions/oral-(viva)/q1');
  });
});
