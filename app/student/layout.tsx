import type {ReactNode} from 'react';
import EnterpriseStudentShell from '@/components/student/EnterpriseStudentShell';
import {requirePersonalAccount} from '@/src/lib/business';

export default async function StudentLayout({children}:{children:ReactNode}){await requirePersonalAccount();return <EnterpriseStudentShell>{children}</EnterpriseStudentShell>}
