import { Reflector } from '@nestjs/core';

const RequiresVerification = Reflector.createDecorator<boolean>();
export default RequiresVerification;
