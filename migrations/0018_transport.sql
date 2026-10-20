CREATE TABLE transport_vehicles (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), vehicle_number TEXT NOT NULL, model TEXT,
 capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 1000), driver_name TEXT NOT NULL, driver_phone TEXT NOT NULL, driver_license TEXT, gps_device_id TEXT,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), archived_at INTEGER,
 UNIQUE(school_id,id), UNIQUE(school_id,vehicle_number)
);
CREATE TABLE transport_routes (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), academic_year_id TEXT NOT NULL REFERENCES academic_years(id), vehicle_id TEXT NOT NULL,
 name TEXT NOT NULL, code TEXT NOT NULL, start_location TEXT NOT NULL, end_location TEXT NOT NULL,
 pickup_start TEXT NOT NULL,pickup_end TEXT NOT NULL,drop_start TEXT NOT NULL,drop_end TEXT NOT NULL,
 weekdays_json TEXT NOT NULL CHECK(json_valid(weekdays_json)),fare_minor INTEGER NOT NULL CHECK(typeof(fare_minor)='integer' AND fare_minor BETWEEN 0 AND 1000000000000),currency TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), archived_at INTEGER,
 FOREIGN KEY(school_id,vehicle_id) REFERENCES transport_vehicles(school_id,id),
 UNIQUE(school_id,id),UNIQUE(school_id,academic_year_id,code),CHECK(pickup_start<pickup_end AND pickup_end<=drop_start AND drop_start<drop_end)
);
CREATE TABLE transport_stops (
 id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),route_id TEXT NOT NULL,name TEXT NOT NULL,pickup_time TEXT NOT NULL,drop_time TEXT NOT NULL,sort_order INTEGER NOT NULL CHECK(sort_order BETWEEN 1 AND 1000),fare_minor INTEGER NOT NULL CHECK(typeof(fare_minor)='integer' AND fare_minor BETWEEN 0 AND 1000000000000),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),archived_at INTEGER,
 FOREIGN KEY(school_id,route_id) REFERENCES transport_routes(school_id,id),UNIQUE(school_id,id),UNIQUE(school_id,route_id,sort_order),CHECK(pickup_time<drop_time)
);
CREATE TABLE transport_assignments (
 id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),academic_year_id TEXT NOT NULL REFERENCES academic_years(id),student_id TEXT NOT NULL REFERENCES students(id),route_id TEXT NOT NULL,stop_id TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),archived_at INTEGER,
 FOREIGN KEY(school_id,route_id) REFERENCES transport_routes(school_id,id),FOREIGN KEY(school_id,stop_id) REFERENCES transport_stops(school_id,id),UNIQUE(school_id,id)
);
CREATE UNIQUE INDEX transport_one_active_student ON transport_assignments(school_id,academic_year_id,student_id) WHERE archived_at IS NULL;
CREATE INDEX transport_route_roster ON transport_assignments(school_id,route_id,archived_at);
CREATE TRIGGER transport_route_tenant BEFORE INSERT ON transport_routes WHEN NOT EXISTS(SELECT 1 FROM academic_years WHERE id=NEW.academic_year_id AND school_id=NEW.school_id) BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER transport_route_identity BEFORE UPDATE ON transport_routes WHEN NEW.school_id!=OLD.school_id OR NEW.academic_year_id!=OLD.academic_year_id OR NEW.currency!=OLD.currency BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER transport_stop_identity BEFORE UPDATE ON transport_stops WHEN NEW.school_id!=OLD.school_id OR NEW.route_id!=OLD.route_id BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER transport_assignment_tenant BEFORE INSERT ON transport_assignments
WHEN NOT EXISTS(SELECT 1 FROM students WHERE school_id=NEW.school_id AND id=NEW.student_id AND academic_year_id=NEW.academic_year_id)
 OR NOT EXISTS(SELECT 1 FROM transport_routes WHERE school_id=NEW.school_id AND id=NEW.route_id AND academic_year_id=NEW.academic_year_id)
 OR NOT EXISTS(SELECT 1 FROM transport_stops WHERE school_id=NEW.school_id AND id=NEW.stop_id AND route_id=NEW.route_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER transport_assignment_identity BEFORE UPDATE ON transport_assignments
WHEN NEW.school_id!=OLD.school_id OR NEW.academic_year_id!=OLD.academic_year_id OR NEW.student_id!=OLD.student_id
 OR NOT EXISTS(SELECT 1 FROM transport_routes WHERE school_id=NEW.school_id AND id=NEW.route_id AND academic_year_id=NEW.academic_year_id)
 OR NOT EXISTS(SELECT 1 FROM transport_stops WHERE school_id=NEW.school_id AND id=NEW.stop_id AND route_id=NEW.route_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
