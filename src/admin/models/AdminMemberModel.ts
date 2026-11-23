import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * People given admin access from the dashboard. Owners (the ADMIN_EMAILS setting) are always
 * admins and aren't stored here. Keyed by email, lower-case, so access works whichever way the
 * person signs in.
 */
@Table({ tableName: 'admin_member' })
export class AdminMemberModel extends Model<AdminMemberModel> {
  @Column({ type: DataType.STRING(191), primaryKey: true })
  email: string;

  /** The owner who added them. */
  @Column({ type: DataType.STRING(191), field: 'added_by', allowNull: true })
  addedBy: string | null;

  @Column({ type: DataType.DATE, field: 'created_on', allowNull: false })
  createdOn: Date;
}
