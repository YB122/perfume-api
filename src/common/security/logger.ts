/**
 * Winston logger configured for security.log with Africa/Cairo timezone.
 * Ported/adapted from the shared e-commerce security logger.
 */
import winston from 'winston';

const egyptTimeFormat = winston.format((info) => {
  const egyptTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());

  const [month, day, year, hour, minute, second] = egyptTime.split(/[/, :]/);
  info.timestamp = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  return info;
});

export const securityLogger = winston.createLogger({
  level: 'warn',
  format: winston.format.combine(egyptTimeFormat(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'security.log', level: 'warn' }),
  ],
});

export default securityLogger;
