import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import {
  clearAdminCache,
  isOwnerEmail,
  looksLikeEmail,
  normalEmail,
} from '../adminAccess';
import { fullName, initialsOf, iso, run, select } from '../sql';

export interface TeamMember {
  email: string;
  /** Set on the server (ADMIN_EMAILS): can add and remove admins, can't be removed here. */
  owner: boolean;
  /** Their account, when they have one. */
  userId: string | null;
  name: string | null;
  initials: string;
  addedBy: string | null;
  addedOn: string | null;
}

/** The admin team: owners from the server setting, plus the admins owners add here. */
@Injectable()
export class AdminTeamService {
  async list(viewerEmail?: string | null) {
    const owners = EnvironmentVariables.config.adminEmails.map(normalEmail);
    const members = await select<{
      email: string;
      added_by: string | null;
      created_on: Date | string;
    }>(
      `SELECT email, added_by, created_on FROM admin_member ORDER BY created_on`,
    );
    const emails = [
      ...new Set([...owners, ...members.map((m) => normalEmail(m.email))]),
    ];
    const accounts = emails.length
      ? await select<{
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          role: string;
        }>(
          `SELECT id, email, first_name, last_name, role FROM user WHERE LOWER(email) IN (:emails)`,
          { emails },
        )
      : [];
    const byEmail = new Map(accounts.map((a) => [normalEmail(a.email), a]));
    const row = (
      email: string,
      owner: boolean,
      addedBy: string | null,
      addedOn: unknown,
    ): TeamMember => {
      const a = byEmail.get(email);
      const name = a ? fullName(a.first_name, a.last_name, a.role) : null;
      return {
        email,
        owner,
        userId: a?.id ?? null,
        name,
        initials: initialsOf(name ?? email),
        addedBy,
        addedOn: iso(addedOn),
      };
    };
    return {
      canManage: isOwnerEmail(viewerEmail),
      you: normalEmail(viewerEmail),
      admins: [
        ...owners.map((e) => row(e, true, null, null)),
        ...members
          .filter((m) => !owners.includes(normalEmail(m.email)))
          .map((m) =>
            row(normalEmail(m.email), false, m.added_by, m.created_on),
          ),
      ],
    };
  }

  private assertOwner(viewerEmail?: string | null) {
    if (!isOwnerEmail(viewerEmail)) {
      throw new HttpException(
        'Only owners can add or remove admins.',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  async add(viewerEmail: string | null | undefined, rawEmail: unknown) {
    this.assertOwner(viewerEmail);
    const email = normalEmail(typeof rawEmail === 'string' ? rawEmail : '');
    if (!looksLikeEmail(email)) {
      throw new HttpException(
        'Enter an email address, like name@example.com.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!isOwnerEmail(email)) {
      await run(
        `INSERT INTO admin_member (email, added_by, created_on) VALUES (:email, :by, :now)
         ON DUPLICATE KEY UPDATE email = email`,
        { email, by: normalEmail(viewerEmail), now: new Date() },
      );
      clearAdminCache();
    }
    return this.list(viewerEmail);
  }

  async remove(viewerEmail: string | null | undefined, rawEmail: string) {
    this.assertOwner(viewerEmail);
    const email = normalEmail(rawEmail);
    if (isOwnerEmail(email)) {
      throw new HttpException(
        'Owners are set on the server (ADMIN_EMAILS) and can’t be removed here.',
        HttpStatus.BAD_REQUEST,
      );
    }
    await run(`DELETE FROM admin_member WHERE email = :email`, { email });
    clearAdminCache();
    return this.list(viewerEmail);
  }
}
