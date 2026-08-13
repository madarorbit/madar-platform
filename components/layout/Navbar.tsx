import {getOptionalShellIdentity} from '@/src/lib/shell/server';
import NavbarClient from './NavbarClient';

export default async function Navbar(){
 const identity=await getOptionalShellIdentity();
 return <NavbarClient authenticated={Boolean(identity)} displayName={identity?.shell.displayName} hasAvatar={Boolean(identity?.shell.hasAvatar)} isAdmin={Boolean(identity?.shell.isAdmin)} unread={identity?.shell.unread||0} notifications={identity?.shell.notifications||[]}/>;
}
